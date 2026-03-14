# Discover Quality Audit — 50 Test Queries

This document provides a structured set of 50 test queries to evaluate the Discover pipeline's quality across different dimensions: role-based, skill-based, geography, industry, mixed-language, edge cases, and broad fallback scenarios.

## How to Use

Run each query through the Discover search and evaluate:
- **Result count**: >= 5 is good, >= 10 is excellent
- **Precision**: % of results that match the intent (target: >= 70%)
- **Diversity**: results from different companies/backgrounds
- **Ranking**: most relevant results appear first

## Category 1: Role-Based Queries (10)

| # | Query | Expected Roles | Min Results |
|---|-------|---------------|-------------|
| 1 | CTO at Series A startups | CTO, Co-founder/CTO | 5 |
| 2 | VP of Engineering at FAANG | VP Eng, SVP Eng, Director Eng | 5 |
| 3 | Head of Product at fintech companies | Head of Product, VP Product, CPO | 5 |
| 4 | Startup founders in healthcare | Founder, CEO, Co-founder | 5 |
| 5 | Angel investors focused on AI | Angel Investor, Investor, VC | 5 |
| 6 | DevRel engineers at developer tools | DevRel, Developer Advocate, Dev Evangelist | 5 |
| 7 | Chief Data Officer at enterprise | CDO, VP Data, Head of Data | 5 |
| 8 | Growth marketing leads at SaaS | Head of Growth, VP Growth, Growth Lead | 5 |
| 9 | Design directors at consumer tech | Design Director, VP Design, Head of Design | 5 |
| 10 | ML engineers at autonomous driving | ML Engineer, AI Engineer, Research Scientist | 5 |

## Category 2: Skill-Based Queries (10)

| # | Query | Expected Skills | Min Results |
|---|-------|----------------|-------------|
| 11 | People who know Kubernetes and cloud architecture | Kubernetes, Cloud, DevOps | 5 |
| 12 | Experts in natural language processing | NLP, LLM, Computational Linguistics | 5 |
| 13 | Blockchain developers with Solidity experience | Solidity, Web3, Smart Contracts | 5 |
| 14 | Data scientists using Python and TensorFlow | Data Science, Python, ML | 5 |
| 15 | UX researchers with enterprise experience | UX Research, User Research, Usability | 5 |
| 16 | Full-stack developers with React and Node | React, Node.js, Full-Stack | 5 |
| 17 | Security engineers specializing in zero trust | Security, Zero Trust, InfoSec | 5 |
| 18 | Mobile developers with Flutter expertise | Flutter, Dart, Mobile Dev | 5 |
| 19 | People skilled in revenue operations | RevOps, Revenue Operations, Sales Ops | 5 |
| 20 | Technical writers for API documentation | Technical Writing, API Docs, Developer Docs | 5 |

## Category 3: Geography-Based Queries (8)

| # | Query | Expected Location | Min Results |
|---|-------|------------------|-------------|
| 21 | Tech founders in Berlin | Berlin, Germany | 5 |
| 22 | AI researchers in London | London, UK | 5 |
| 23 | Startup ecosystem leaders in Singapore | Singapore | 5 |
| 24 | Product managers in Toronto | Toronto, Canada | 5 |
| 25 | Venture capitalists in Tel Aviv | Tel Aviv, Israel | 5 |
| 26 | Engineering managers in Bangalore | Bangalore, India | 5 |
| 27 | Fintech founders in New York | New York, NY | 5 |
| 28 | Climate tech leaders in Stockholm | Stockholm, Sweden | 3 |

## Category 4: Industry-Specific Queries (7)

| # | Query | Expected Industry | Min Results |
|---|-------|------------------|-------------|
| 29 | Leaders in edtech and online learning | EdTech, Education | 5 |
| 30 | Biotech startup founders | Biotech, Life Sciences | 5 |
| 31 | Proptech innovators and real estate tech | PropTech, Real Estate Tech | 3 |
| 32 | Cybersecurity company executives | Cybersecurity, InfoSec | 5 |
| 33 | Space tech and aerospace engineers | SpaceTech, Aerospace | 3 |
| 34 | Supply chain and logistics tech leaders | Supply Chain, Logistics Tech | 3 |
| 35 | Gaming industry executives and founders | Gaming, Game Dev | 5 |

## Category 5: Mixed-Language Queries (5)

| # | Query | Language Mix | Min Results |
|---|-------|-------------|-------------|
| 36 | разработчики AI в Москве | Russian + English | 3 |
| 37 | основатели стартапов в Берлине | Russian + German city | 3 |
| 38 | CTO компаний в Кремниевой долине | Russian + English role | 5 |
| 39 | инвесторы в blockchain проекты | Russian + English tech | 3 |
| 40 | маркетологи в tech компаниях | Russian + English industry | 3 |

## Category 6: Edge Cases and Stress Tests (5)

| # | Query | Edge Case Type | Expected Behavior |
|---|-------|---------------|-------------------|
| 41 | a | Single character | Graceful error or empty results |
| 42 | asdfghjkl random nonsense | Gibberish | Empty results, no crash |
| 43 | CEO OR CTO OR VP at Google AND Facebook AND Apple | Complex boolean | Best-effort parse |
| 44 | (repeat "engineer" 50 times) | Repetitive input | Dedup to single query |
| 45 | 🚀 AI founders 🤖 | Emoji in query | Strip emoji, search normally |

## Category 7: Broad Fallback Scenarios (5)

| # | Query | Fallback Trigger | Expected Behavior |
|---|-------|-----------------|-------------------|
| 46 | Quantum computing ethics researchers in Antarctica | Ultra-niche | Broad fallback activates, relaxes geography |
| 47 | Chief Happiness Officer at Web3 DAOs | Rare role + niche industry | Broad fallback, expands to related roles |
| 48 | Underwater robotics AI engineers in Iceland | Triple constraint | Broad fallback, relaxes 1-2 constraints |
| 49 | Esperanto-speaking blockchain developers | Impossible constraint | Broad fallback, drops language constraint |
| 50 | Neuromarketing specialists at Fortune 10 | Very specific | Broad fallback, expands company scope |

## Scoring Template

For each query, record:

```
Query #: ___
Results returned: ___
Precision (relevant/total): ___% 
Top-3 quality (1-5): ___
Broad fallback used: Y/N
Notes: ___
```

## Quality Targets

| Metric | Target | Acceptable |
|--------|--------|-----------|
| Avg precision | >= 75% | >= 60% |
| Avg result count | >= 8 | >= 5 |
| Broad fallback success rate | >= 80% | >= 60% |
| Mixed-language accuracy | >= 70% | >= 50% |
| Edge case crash rate | 0% | 0% |
