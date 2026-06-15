# Changelog

## 0.0.2

- ihsm cbserver actor network: hierarchical `@InitialState` bootstrap for connection, command, and notification channels.
- Root-only `CBServerInitializeRequest`; child actors auto-start on spawn.
- Mock test suite mirroring real cbserver integration (83 unit + 47 real tests).
- Nix package builds and checks extension `.vsix` plus server bundle offline.

## 0.1.0

- Initial scaffold of the Metamodelling Kit extension.
- Adds the `mmkit.helloWorld` ("Hello World") command.
- LSP and MCP integration to follow.
