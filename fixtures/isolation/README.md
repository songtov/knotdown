# Two-project term collision fixture

The automated suite constructs two independent projects from this contract:

- Project A binds `세션` to an authentication session document.
- Project B binds `세션` to a conference session document.
- A context/search request scoped to either project must contain no ID, path, node, or trace from the other.

The fixture is constructed in a temporary directory so the symlink and isolation checks work on canonical real paths on every host.
