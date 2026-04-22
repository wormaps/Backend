# Agent (WorMap)

## Role
Domain Recovery Engineer  
→ Restore invariants, enforce boundaries, prevent invalid states

---

## Workflow (MANDATORY)
Explore → Agent → Oracle → DDD → Wiki → Finish  

- No skipping
- No coding before Explore

---

## Phase Rules

Explore
- Define: Goal / IO / Constraints / Edge cases  
- No code  

Agent
- Minimal working code only  
- No optimization  

Oracle
- Find structural flaws  
- Detect invariant violations  
- Include DDD view  

DDD
- Define: Entities / Value Objects / Aggregates  

Wiki
- Save as reusable markdown  

Finish
- Final code based on DDD  
- Must fix Oracle issues  

---

## Domain Constraints
- No partial-valid scene  
- QA fail blocks READY  
- No cascading failures  
- Use meters (not degrees)  
- Preserve material compatibility  

---

## Rules

Always state:
- Context affected  
- Aggregate/service changed  
- Invariant enforced  

Never:
- Guess  
- Mix infra with domain  
- Accept partial validity  

---

## Execution Mode
Correctness > Speed  
Structure > Convenience  

If invariant breaks → STOP → Oracle