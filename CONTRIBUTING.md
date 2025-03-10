# Contributing to LM Studio Proxy

Thank you for considering contributing to LM Studio Proxy! This document outlines the process for contributing to the project.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## How Can I Contribute?

### Reporting Bugs

- Before submitting a bug report, please check the existing issues to see if the problem has already been reported.
- Use the bug report template when creating a new issue.
- Include detailed steps to reproduce the bug.
- Include any relevant logs or error messages.

### Suggesting Enhancements

- Use the feature request template when suggesting enhancements.
- Explain how the enhancement would benefit the project.
- Include any relevant examples or mockups.

### Pull Requests

1. Fork the repository.
2. Create a new branch for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Make your changes.
4. Run tests and linting to ensure your changes don't break existing functionality:
   ```bash
   yarn test
   yarn lint
   ```
5. Commit your changes using [conventional commit messages](https://www.conventionalcommits.org/):
   ```bash
   git commit -m "feat: add new feature"
   ```
6. Push your changes to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
7. Create a pull request to the main repository's `main` branch.

## Development Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/a14a-org/lmstudio-proxy.git
   cd lmstudio-proxy
   ```

2. Install dependencies:

   ```bash
   yarn install
   ```

3. Build all packages:

   ```bash
   yarn build
   ```

4. Run tests:
   ```bash
   yarn test
   ```

## Coding Guidelines

- Follow the existing code style (enforced by ESLint and Prettier).
- Write tests for new functionality.
- Update documentation for any changes affecting public APIs.
- Keep pull requests focused on a single concern.

## Project Structure

- `packages/common` - Shared types and utilities
- `packages/client` - Local proxy client that runs alongside LM Studio
- `packages/server` - Remote API server that handles authentication and request routing

## License

By contributing, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).
