# hyperlink.injection

Lets a language grammar highlight URLs inside its own strings and comments, by injecting the hyperlink grammar at nodes it nominates.

|             |                                                              |
| ----------- | ------------------------------------------------------------ |
| Version     | `1.0.0`                                                      |
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
      "versions": { "^1.0.0": "consumeHyperlinkInjection" }
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
      language?(node: Node): string | null | undefined;
      content?(node: Node): Node | Node[];
      languageScope?: string | null;
      includeChildren?: boolean;
    },
  ): Disposable;

  test(node: Node): boolean;
};
```

| Member                                  | Description                                                                                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `addInjectionPoint(scopeName, options)` | Registers an injection point on a grammar and returns its cleanup. `scopeName` is the parent language's scope, e.g. `source.python`. |
| `options.types`                         | Required. One node type or an array of them — the nodes that may contain a URL.                                                      |
| `options.language(node)`                | Optional. Return a language name to force one, `null` to suppress the injection, or `undefined` to fall through to the default test. |
| `options.content(node)`                 | Optional. Narrows the injection to some of the node's children. Defaults to the node itself.                                         |
| `options.languageScope`                 | Optional. Sets scopes on the injected ranges; defaults to `null`, so only hyperlink captures are added.                              |
| `options.includeChildren`               | Optional. Includes descendants in the injected ranges. Defaults to `false`.                                                          |
| `test(node)`                            | The default check — whether the node's text contains a URL. Exposed for a custom `language` callback.                                |

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

By default the hyperlink grammar is injected only into nodes whose text contains an HTTP or HTTPS prefix, which is what keeps this cheap on large files. Static rules and the service's default test use the same `injectionContentRegex` from the target grammar descriptor. Supplying your own `language` callback replaces that test for the cases it answers; call `test(node)` inside it to keep the default behavior for the rest. The target prefilter is applied only to static rules, so a JavaScript callback can still deliberately override the default test.

Pick the narrowest node types that can hold a URL. `comment` and `string_content` are the usual pair; injecting into a whole `string` node re-scans the quotes for nothing.

Registration happens when the service edge is connected and is owned by that edge — see Teardown.

## Teardown

`addInjectionPoint` returns a `Disposable` that removes every injection point created for `options.types`. A consumer must return that disposable from its service callback; when it registers several scopes, it returns one aggregate disposable that owns them all. This lets provider disable, consumer disable and package reactivation remove the old generation before reconnecting the edge.

## Versioning

`1.0.0` provided, `^1.0.0` consumed. A change that breaks this shape gets a new service name rather than a new major version, and both sides move in the same release.
