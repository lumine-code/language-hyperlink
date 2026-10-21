module.exports = {
  provideHyperlinkInjection() {
    const modulePath = require.resolve("./syntax-injections");
    return {
      modulePath,
      testText: (text) => require(modulePath).testText(text),
      addInjectionPoint: (scopeName, options) =>
        lumine.grammars.registerSyntaxModule(modulePath, { args: [scopeName, options] }),
    };
  },
};
