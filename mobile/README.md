# mobile

The FindMyDoctor Flutter frontend. Run Flutter commands from this directory.

## Source layout

```text
lib/
+-- app/       # App composition, routing, and theme
+-- core/      # Shared infrastructure and reusable primitives
+-- features/  # Feature-owned screens, state, models, and data access
+-- main.dart  # Process entrypoint
```

Feature code should stay inside its feature directory. API calls belong in the
frontend data layer and must target the backend REST API; the app must not
connect directly to PostgreSQL or an external AI provider.

## Getting Started

This project is a starting point for a Flutter application.

A few resources to get you started if this is your first Flutter project:

- [Learn Flutter](https://docs.flutter.dev/get-started/learn-flutter)
- [Write your first Flutter app](https://docs.flutter.dev/get-started/codelab)
- [Flutter learning resources](https://docs.flutter.dev/reference/learning-resources)

For help getting started with Flutter development, view the
[online documentation](https://docs.flutter.dev/), which offers tutorials,
samples, guidance on mobile development, and a full API reference.
