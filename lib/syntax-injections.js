const pattern = new RegExp(require("../grammars/hyperlink.json").injectionContentRegex);
function register(grammars, scopeName, options) {
  const types = Array.isArray(options.types) ? options.types : [options.types];
  const registrations = types.map((type) =>
    grammars.addInjectionPoint(scopeName, {
      type,
      language: (node) =>
        options.language !== undefined
          ? options.language
          : register.test(node)
            ? "hyperlink"
            : undefined,
      content: (node) =>
        options.contentField ? node.childForFieldName(options.contentField) : node,
      languageScope: options.languageScope ?? null,
      includeChildren: options.includeChildren ?? false,
    }),
  );
  return {
    dispose() {
      for (const registration of registrations.splice(0)) registration.dispose();
    },
  };
}
register.testText = (text) => pattern.test(text);
register.test = (node) => register.testText(node.text);
module.exports = register;
