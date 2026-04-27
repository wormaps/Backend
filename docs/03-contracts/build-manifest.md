# Build Manifest Contract

`SceneBuildManifest`는 build 재현성과 감사의 기준이다.

## 포함

- build id
- build state
- schema versions
- rule versions
- package versions
- input hashes
- artifact hashes
- attribution summary
- compliance issues

## 규칙

- 같은 input/version에서 manifest-compatible 출력이 나와야 한다.
- schema breaking change는 migration spec 또는 major bump가 필요하다.
