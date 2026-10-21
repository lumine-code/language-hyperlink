# hyperlink.injection

Lets a language grammar highlight URLs inside its own strings and comments, by injecting the hyperlink grammar at nodes it nominates.

|             |                                                              |
| ----------- | ------------------------------------------------------------ |
| Version     | `2.0.0`                                                      |
| Provided by | `provideHyperlinkInjection()` returning the injection helper |
| Consumed by | `consumeHyperlinkInjection(hyperlink)`                       |
| Owner       | `language-hyperlink` (bundled)                               |

Prefer a static injection query when the syntax tree identifies the URL-bearing nodes. This service remains available when eligibility or content needs runtime logic. The sibling service `todo.injection` has an identical shape.

## Registration

For static rules, declare `treeSitter.injectionsQuery` in the parent grammar descriptor and put this pattern in the referenced SCM file:

```scheme
([(comment) (string_content)] @injection.owner @injection.content
  (#set! injection.language "hyperlink")
  (#set! injection.include-children)
  (#set! injection.language-scope "none"))
```

Replace the node types with the actual types in the parent parser. Include children when the comment body lives in a child node; choose literal content nodes for strings so expressions stay outside the injected source. The target grammar declares `injectionContentRegex`, which filters owners without URL prefixes before a child layer is created. No consumed service or JavaScript entry point is needed. The editor adds injections when the target grammar becomes available and removes them when it is disabled.

For the JavaScript service, declare this in your `package.json`:

```json
{
  "consumedServices": {
    "hyperlink.injection": {
      "versions": { "^2.0.0": "consumeHyperlinkInjection" }
    }
  }
}
```

The service registers Tree-sitter injection points on the exact parent grammar scopes supplied by the consumer.

## Contract

```ts
type HyperlinkInjection = {
  addInjectionPoint(
    scopeName: string,
    options: {
      types: string | string[];
      language?: string | null;
      contentField?: string;
      languageScope?: string | null;
      includeChildren?: boolean;
    },
  ): Disposable;

  testText(text: string): boolean;
  modulePath: string;
};
```

| Member                                  | Description                                                                                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `addInjectionPoint(scopeName, options)` | Registers an injection point on a grammar and returns its cleanup. `scopeName` is the parent language's scope, e.g. `source.python`. |
| `options.types`                         | Required. One node type or an array of them — the nodes that may contain a URL.                                                      |
| `options.languageScope`                 | Optional. Sets scopes on the injected ranges; defaults to `null`, so only hyperlink captures are added.                              |
| `options.includeChildren`               | Optional. Includes descendants in the injected ranges. Defaults to `false`.                                                          |

The service registers a syntax module in each parser owner. Options must be serializable: `language` forces a constant language name or suppresses the injection with `null`, and `contentField` selects a named child field. For custom callbacks, register your own module with `lumine.grammars.registerSyntaxModule`, pass `modulePath` as a factory argument, and call `require(modulePath).test(node)` inside that module. Syntax nodes stay with their parser. `testText(text)` exposes the same eligibility check for ordinary strings.

## Minimal example

```js
const SCOPES = ["source.mylang", "source.mylang.embedded"];

exports.consumeHyperlinkInjection = (hyperlink) => {
  const registrations = SCOPES.map((scope) =>
    hyperlink.addInjectionPoint(scope, { types: ["comment", "string_content"] }),
  );
  return {
    dispose() {
      for (const registration of registrations.splice(0)) registration.dispose();
    },
  };
};
```

## Behavior

Call `addInjectionPoint` once per scope name your package ships. A grammar with dialects registers each scope separately — the scope table is keyed by exact name, not by prefix, so `source.python` does not cover `source.python.ipy`.

Pick the narrowest node types that can hold a URL. `comment` and `string_content` are the usual pair; injecting into a whole `string` node re-scans the quotes for nothing.

Registration happens when the service edge is connected and is owned by that edge — see Teardown.

## Teardown

`addInjectionPoint` returns a `Disposable` that removes every injection point created for `options.types`. A consumer must return that disposable from its service callback; when it registers several scopes, it returns one aggregate disposable that owns them all. This lets provider disable, consumer disable and package reactivation remove the old generation before reconnecting the edge.

## Versioning

`2.0.0` provided, `^2.0.0` consumed. Version 2 replaces renderer-owned node callbacks with serializable options and parser-owned syntax modules. Consumers must use `^2.0.0`; custom node callbacks belong in their syntax module.
