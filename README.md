# language-hyperlink

Hyperlink colorization.

## Features

- **Grammars**: provides a Tree-sitter grammar built from [tree-sitter-hyperlink](https://github.com/lumine-code/tree-sitter-hyperlink).
- **Syntax highlighting**: highlights hyperlinks embedded in strings, comments, and plain text.
- **Static injections**: accepts the `hyperlink` alias in injection queries and filters out owners without URL prefixes.

## Installation

To install `language-hyperlink` search for it in the Install pane of the Lumine settings, or run the command `lumine --install lumine-code/language-hyperlink`.

## Services

- [`hyperlink.injection`](docs/hyperlink.injection.md): provided for JavaScript injection rules that need runtime logic; static rules use the grammar's `hyperlink` alias directly.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
