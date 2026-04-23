# Prompt Versioning Strategy

Prompts are treated as versioned application assets rather than inline strings.

- Each version lives under `prompts/vN/`.
- Runtime loading is handled by `PromptLoader`, which caches templates at startup.
- New versions are additive. Existing versions remain immutable so prior behavior is reproducible.
- The active version is logged at startup to make deployments auditable.
- Template variables use `{{variable}}` interpolation and are rendered close to call sites.
