# Provider Budget Policy

## Contract

Provider budget은 `ProviderBudgetPolicy`로 표현한다.

## Fields

- provider
- maxRequestsPerBuild
- maxRetriesPerRequest
- timeoutMs
- backoffPolicy
- cacheReuseWindowSec
- fallbackAllowed

## Gate

budget 초과는 preflight에서 context shrink, scene split, reject 중 하나로 처리한다.
