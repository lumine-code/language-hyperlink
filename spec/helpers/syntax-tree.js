exports.inspect = (context) => {
  const root = context.getRootSyntaxNode();
  return {
    hasError: root.hasError,
    links: root.descendantsOfType("url").map((node) => ({
      text: node.text,
      startPosition: node.startPosition,
      endPosition: node.endPosition,
      startIndex: node.startIndex,
      endIndex: node.endIndex,
    })),
  };
};
