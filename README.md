# wormapb

## Status

![CI](https://github.com/wormaps/Backend/actions/workflows/ci.yml/badge.svg)

| Phase | Status |
|-------|--------|
| Phase 19 GLB Pipeline | ✅ Complete |
| Testing | 42 pass, 0 fail |
| CI/CD | ✅ Configured |

To install dependencies:

```bash
pnpm install
```

To run:

```bash
pnpm run 
```

This project was created using `pnpm init` in pnpm v1.3.13. [pnpm](https://pnpm.com) is a fast all-in-one JavaScript runtime.

## Run

```bash
# Development (hot reload)
pnpm run dev

# Production
pnpm run start
```

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api` | GET | API documentation |
| `/api/build` | POST | Build GLB from OSM data |

### Build GLB

```bash
curl -X POST http://localhost:8080/api/build \
  -H "Content-Type: application/json" \
  -d '{"sceneId":"gangnam","lat":37.498,"lng":127.0277,"radius":150}'
```

Open http://localhost:8080 in browser for the test page.
