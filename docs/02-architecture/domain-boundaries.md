# Domain Boundaries

## Provider Domain

- Google Places, Overpass, Open-Meteo, TomTom 호출
- raw payload, query hash, response hash, compliance metadata

## Contract Domain

- `SourceSnapshot`
- `EvidenceGraph`
- `TwinSceneGraph`
- `RenderIntentSet`
- `MeshPlan`
- `SceneBuildManifest`

## Rendering Domain

- Render intent resolution
- Mesh planning
- GLB compile

## 금지 경계

- raw provider schema는 GLB compiler로 넘어갈 수 없다.
- GLB compiler는 confidence/provenance를 생성할 수 없다.
- normalization은 visual detail 결정을 하지 않는다.
