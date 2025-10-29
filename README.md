# AI Trading Intelligence System — MVP Architecture

An autonomous, multi-agent trading system powered by LLMs that combines real-time news sentiment analysis, quantitative signal reasoning, and investor personality archetypes to generate trading signals across multiple asset classes.

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [Technology Stack](#technology-stack)
4. [Core Components & LLM Reasoning Loops](#core-components--llm-reasoning-loops)
5. [Data Flow & Kafka Topics](#data-flow--kafka-topics)
6. [Personality Modes (LLM-based)](#personality-modes-llm-based)
7. [MVP Scope & Constraints](#mvp-scope--constraints)
8. [Frontend Architecture](#frontend-architecture)
9. [Project Structure](#project-structure)
10. [Getting Started](#getting-started)
11. [Future Phases](#future-phases)

---

## 🎯 Project Overview

This system implements a **three-agent LLM architecture** using LangGraph that processes real-time news, reasons about market signals, applies investor-specific decision logic, and generates trading recommendations for live execution.

**Key Innovation:** Instead of hard-coded rules, each agent uses an LLM to reason through multi-step decision logic:
- News Agent reasons about deduplication, sentiment, and impact
- Investment Agent reasons about signal fusion and correlation
- Personality Agent reasons through an investor's decision-making lens
- Research Agent (optional) conducts deep reasoning on large positions

### Core Problem Solved
- Most trading systems use rigid rules and miss nuance.
- This system leverages LLM reasoning to understand context, detect contradictions, and make probabilistic decisions.
- Personality modes allow the same signals to be interpreted through different investor reasoning styles (Buffett = value; Soros = momentum; Cathie = innovation).

### MVP Goals
- Validate that LLM-based signal reasoning produces edge over rule-based systems.
- Demonstrate multi-agent LangGraph architecture with Kafka streaming.
- Support mode-switching without disrupting existing positions.
- Backtest concept before scaling.

---

## 🏗️ System Architecture

### High-Level Flow

```
┌──────────────────────────────────────────────────┐
│  NEWS SOURCES (Live APIs)                        │
│  - Reddit (PRAW)                                 │
│  - Twitter/X (tweepy)                            │
│  - CoinTelegraph (RSS/web scrape)                │
│  - NewsAPI (free tier)                           │
│  Expected: ~10 articles/minute                   │
└──────────────┬───────────────────────────────────┘
               │
      [Kafka Producer: raw_news]
               │
┌──────────────▼───────────────────────────────────┐
│  NEWS AGENT (LangGraph State Graph)              │
│  ├─ Deduplication Node                          │
│  │  (LLM: "Are these the same event?")          │
│  ├─ Event Extraction Node                       │
│  │  (LLM: "What's happening? Extract ticker")   │
│  ├─ Sentiment Analysis Node                     │
│  │  (LLM: "Analyze sentiment + impact level")   │
│  └─ Signal Emission Node                        │
│     (Emit structured signal to Kafka)            │
└──────────────┬───────────────────────────────────┘
               │
      [Kafka: processed_signals]
               │
┌──────────────▼───────────────────────────────────┐
│  INVESTMENT AGENT (LangGraph State Graph)        │
│  ├─ Signal Collection Node                      │
│  │  (Consume news signals + fetch quant data)   │
│  ├─ Signal Fusion Reasoning Node                │
│  │  (LLM: "How do sentiment, RSI, volume        │
│  │   align? What's the overall picture?")       │
│  ├─ Position Sizing Node                        │
│  │  (LLM: "Given risks, what size?")            │
│  └─ Trade Recommendation Node                   │
│     (LLM: "BUY/SELL/HOLD + confidence")         │
└──────────────┬───────────────────────────────────┘
               │
      [Kafka: trade_signals (pre-execution)]
               │
┌──────────────▼───────────────────────────────────┐
│  PERSONALITY AGENT (LangGraph State Graph)       │
│  ├─ Load Persona Context Node                   │
│  │  (Redis: fetch current mode context)         │
│  ├─ Persona Reasoning Node                      │
│  │  (LLM: "How would [persona] see this trade?")│
│  ├─ Decision Adjustment Node                    │
│  │  (LLM: "Adjust confidence or veto?")         │
│  └─ Validation Node                             │
│     (Emit final trade decision)                  │
└──────────────┬───────────────────────────────────┘
               │
      [Kafka: validated_trades]
               │
┌──────────────▼───────────────────────────────────┐
│  OPTIONAL: PARALLEL RESEARCH AGENT               │
│  ├─ Large Trade Filter Node                     │
│  │  (Size > $10k threshold)                     │
│  ├─ Research Reasoning Node                     │
│  │  (LLM: "Research this company")              │
│  ├─ Call Parallel API Tool                      │
│  │  (Fetch deep research findings)              │
│  └─ Signal Validation Node                      │
│     (LLM: "Do findings confirm or deny?")       │
└──────────────┬───────────────────────────────────┘
               │
      [Kafka: researched_trades]
               │
┌──────────────▼───────────────────────────────────┐
│  BROKER AGENT (Hybrid: Rules + Light LLM)             │
│  ├─ Risk Check Node (Rules)                     │
│  │  (Position limits, leverage checks)          │
│  ├─ Order Execution Node (Rules)                │
│  │  (Place order via Binance API)               │
│  └─ Trade Tracking Node                         │
│     (Log to SQLite, emit to Kafka)              │
└──────────────┬───────────────────────────────────┘
               │
      [Kafka: executed_trades]
               │
┌──────────────▼───────────────────────────────────┐
│  ANALYTICS & STATE STORE                         │
│  ├─ SQLite: trades, signals, positions          │
│  ├─ Redis: mode persistence, LLM context cache  │
│  ├─ Streamlit Dashboard                         │
│  └─ Performance metrics (Sharpe, Win Rate, etc.)│
└──────────────────────────────────────────────────┘
```

---

## 🛠️ Technology Stack

| Layer | Tool/Framework | Purpose | Why |
|-------|---|---|---|
| **Language** | TypeScript + Node.js | Application runtime | Native type safety, async/await support |
| **Streaming** | Apache Kafka (Docker) | Real-time event bus | Decoupled agents, replay-able history, scalable |
| **LLM Agent Framework** | LangGraph | Multi-agent orchestration | First-class agent loops, tool use, state management |
| **LLM Provider** | Claude (Anthropic) or OpenAI | LLM reasoning | Fast, reliable reasoning over text + data |
| **News Ingestion** | PRAW, tweepy, requests | Reddit, Twitter, web scraping | Free, well-maintained, real-time |
| **Tools for Agents** | @langchain/core Tools | Structured tool use | Sentiment scoring, quant data fetching, API calls |
| **Vector DB** | LanceDB (local) | News deduplication | Fast semantic similarity, no cloud deps |
| **Embeddings** | sentence-transformers (local) | Sentence embeddings | Lightweight, runs locally for dedup |
| **State Store** | Redis + SQLite | Mode persistence, trade tracking | Fast KV for mode + context, persistent audit trail |
| **Database** | SQLite (local) | Trades, signals, metrics | Zero-ops, ACID compliance, easy to inspect |
| **Dashboard** | Streamlit | Live monitoring & visualization | Fast prototyping, real-time updates |
| **Data Serialization** | Zod (TypeScript) | Message validation | Type-safe schemas, better than Avro for MVP |
| **Logging** | Pino | Structured logging | Fast JSON logging, trace agent reasoning |
| **Web Research** | Parallel API | Deep research on positions | High-accuracy fact gathering for large trades |

---

## 🧠 Core Components & LLM Reasoning Loops

### 1. News Agent (LangGraph State Graph)

**Purpose:** Consume raw news from multiple sources, reason about deduplication, analyze sentiment, extract impact, emit structured signals.

**LLM Reasoning Loops:**

**Node 1: Deduplication Reasoning**
- Input: Raw articles (headlines, URLs, sources)
- LLM Task: "Given these articles, determine if they describe the same event or different events. Consider: similar headlines, same sources, correlated timing, overlapping subject matter."
- Output: `{ is_duplicate: boolean, event_id: UUID, canonical_url: string }`
- Early Exit: If duplicate, stop processing (return null to Kafka)

**Node 2: Event Extraction & Contextualization**
- Input: Non-duplicate articles
- LLM Task: "Extract the core event from these articles. What happened? What's the ticker/asset affected? Provide 2-3 sentence summary."
- Output: `{ ticker: string, event_summary: string, affected_entities: string[] }`
- Tools Available: 
  - `fetch_company_context()` → get recent company news for context
  - `extract_entities()` → NER for entity recognition

**Node 3: Sentiment & Impact Analysis**
- Input: Event summary + original articles
- LLM Task: "Analyze the sentiment of these articles about [ticker]. Is this news bullish, bearish, or neutral? What's the likely market impact (high/medium/low)? Explain your reasoning."
- Output: `{ sentiment_score: -1.0 to 1.0, confidence: 0.0 to 1.0, impact_level: "high"|"medium"|"low", reasoning: string }`
- Tools Available:
  - `huggingface_sentiment_model()` → call HF FinBERT as reference point
  - `fetch_historical_reactions()` → how has market reacted to similar news?

**Node 4: Signal Emission**
- Input: All analysis from previous nodes
- Action: Emit to Kafka `processed_signals` topic
- Output: Structured signal (JSON to Kafka)

**Kafka Input Topic:** `raw_news`
**Kafka Output Topic:** `processed_signals`

---

### 2. Investment Agent (LangGraph State Graph)

**Purpose:** Fuse sentiment signals with quantitative data, reason about alignment/contradiction, generate trade recommendations.

**LLM Reasoning Loops:**

**Node 1: Signal Collection**
- Input: Consume from Kafka `processed_signals` + latest quant data
- Action: Fetch quantitative indicators from Binance API
  - RSI(14), SMA(20/50), 24h volume, price momentum
- Output: Aggregated state with sentiment + quant signals

**Node 2: Signal Fusion & Correlation Reasoning**
- Input: News sentiment + quant indicators
- LLM Task: "Analyze these signals:
  - Sentiment: [+0.72 (bullish)]
  - RSI: [58 (neutral)]
  - Volume: [+150% spike]
  - SMA: [price above 20/50 crossover (bullish)]
  
  How do these align? Are there contradictions? What's your overall assessment of the signal strength?"
- Output: `{ signal_alignment: string, contradictions: string[], overall_strength: 0.0 to 1.0 }`
- Tools Available:
  - `calculate_rsi()` → compute RSI
  - `calculate_sma()` → compute SMA
  - `fetch_historical_patterns()` → has this exact signal pattern appeared before?
  - `check_correlation()` → is BTC correlated with ETH movement?

**Node 3: Trade Recommendation Reasoning**
- Input: Signal fusion analysis
- LLM Task: "Given the signal analysis above, should we BUY, SELL, or HOLD [ticker]? What's your confidence level (0-1)? What are the risks and rewards? Size recommendation given portfolio constraints?"
- Output: `{ action: "BUY"|"SELL"|"HOLD", confidence: 0.0 to 1.0, entry_price: float, stop_loss: float, take_profit: float, reasoning: string, risk_factors: string[] }`
- Tools Available:
  - `check_portfolio_limits()` → can we add to this position?
  - `calculate_kelly_criterion()` → optimal position size
  - `fetch_sector_momentum()` → is the sector bullish/bearish?

**Node 4: Emit Trade Signal**
- Action: Send to Kafka `trade_signals` topic

**Kafka Input Topic:** `processed_signals`
**Kafka Output Topic:** `trade_signals`

---

### 3. Personality Agent (LangGraph State Graph)

**Purpose:** Apply investor-archetype reasoning to trades; adjust confidence and decisions through a specific persona lens.

**LLM Reasoning Loops:**

**Node 1: Load Persona Context**
- Input: Current mode (from Redis state store)
- Action: Fetch persona system prompt and instructions
- Output: `{ mode: "buffett"|"soros"|"cathie"|"contrarian", persona_context: string }`

**Node 2: Persona-Specific Reasoning**
- Input: Original trade signal + persona context
- LLM Task (varies by persona):
  - **Buffett Mode:** "You are Warren Buffett. You analyze this trade: [signal]. What would you look for? Is there a margin of safety? Is the company a good business with a durable moat? Adjust confidence based on Buffett principles."
  - **Soros Mode:** "You are George Soros reasoning about reflexivity and market dynamics. This signal shows [sentiment shift]. How do you interpret the market's reaction? Is this a systemic opportunity? Adjust confidence."
  - **Cathie Mode:** "You are Cathie Wood. This signal affects [ticker] in the [sector] space. Does this fit innovation themes (AI, biotech, robotics)? How disruptive is this? Adjust confidence."
  - **Contrarian Mode:** "Market consensus is [bullish/bearish]. You find value in contrarian plays. Does this trade contradict mainstream sentiment in a way that presents opportunity? Adjust confidence."
- Output: `{ confidence_adjustment: float, reasoning: string, recommendation: "accept"|"veto"|"reduce_size" }`
- Tools Available:
  - `fetch_persona_history()` → what would [persona] have done in similar past trades?
  - `check_mainstream_sentiment()` → what's the crowd saying?

**Node 3: Final Decision**
- Input: Persona reasoning result
- LLM Task: "Final decision: Given the persona analysis, should we proceed with this trade as recommended, adjust it, or veto it? Confidence final?"
- Output: `{ final_decision: "BUY"|"SELL"|"HOLD", confidence_adjusted: 0.0 to 1.0, mode: string, adjustments_made: string }`

**Node 4: Emit Validated Trade**
- Action: Send to Kafka `validated_trades` topic

**Kafka Input Topic:** `trade_signals`
**Kafka Output Topic:** `validated_trades`

---

### 4. Research Agent (Optional, LLM-powered)

**Purpose:** For large positions, conduct deep research using LLM reasoning + Parallel API to validate/confirm signal.

**LLM Reasoning Loops:**

**Node 1: Large Trade Filter**
- Input: Validated trade signal
- Condition: If size > $10k threshold, proceed; else pass through

**Node 2: Research Question Formation**
- Input: Trade signal (ticker, reason, size)
- LLM Task: "Formulate 3-5 research questions to validate or invalidate this trade signal. What do we need to know about [company/asset]?"
- Output: `{ research_questions: string[], focus_areas: string[] }`

**Node 3: Call Parallel Research API**
- Input: Research questions + ticker + context
- Action: Call Parallel API with LLM + deep research prompt
- Output: `{ findings: string, confidence: 0.0 to 1.0, sources: string[], contradictions: string[] }`

**Node 4: Research Validation Reasoning**
- Input: Original trade + research findings
- LLM Task: "Based on the research findings, does the original trade signal hold up? Are there contradictions? Should we increase confidence, reduce, or veto?"
- Output: `{ validated: boolean, confidence_delta: float, research_summary: string }`

**Node 5: Emit Researched Trade**
- Action: Send to Kafka `researched_trades` topic

**Kafka Input Topic:** `validated_trades`
**Kafka Output Topic:** `researched_trades`

---

### 5. Broker Agent (Hybrid: Rules + Light LLM)

**Purpose:** Execute trades, track positions, enforce risk limits.

**Logic (Mostly Rules, Optional LLM for Edge Cases):**

**Node 1: Risk Check**
- Input: Trade signal
- Rules-Based Validation:
  - Position size < 10% of portfolio
  - Portfolio correlation < 0.8
  - Max leverage < 2x
  - Max daily drawdown < 5%
- Output: `{ risk_approved: boolean, violations: string[] }`
- Optional LLM: On edge cases, LLM can reason about exceptions

**Node 2: Order Execution**
- Input: Risk-approved trade
- Action: Call Binance API, place LIMIT or MARKET order
- Output: `{ order_id: string, status: string, entry_price: float }`

**Node 3: Position Tracking**
- Input: Filled order
- Action: Log to SQLite, emit to Kafka

**Kafka Input Topic:** `validated_trades` or `researched_trades`
**Kafka Output Topic:** `executed_trades`

---

### 6. Analytics & Dashboard

**Purpose:** Monitor live performance, backtest, visualize signals and LLM reasoning.

**Functions:**
- Consume `executed_trades`, calculate P&L
- Calculate metrics: Sharpe ratio, win rate, max drawdown, profit factor
- Track LLM reasoning quality: reasoning accuracy, decision velocity, confidence calibration
- Streamlit dashboard: live signals, positions, P&L, trade history, agent logs

---

## 📡 Data Flow & Kafka Topics

### Kafka Topics Schema (Zod Type Definitions)

**1. `raw_news` (Source)**
```
Topic: raw_news
Retention: 48 hours
Message Type:
  - source: string (reddit, twitter, newsapi, cointelegraph)
  - headline: string
  - content: string
  - url: string
  - published_at: timestamp
  - ticker: string (extracted or heuristic)
```

**2. `processed_signals` (News Agent Output)**
```
Topic: processed_signals
Partitioned by: ticker
Message Type:
  - ticker: string
  - event_id: uuid (deduplicated event)
  - sentiment_score: float [-1.0 to 1.0]
  - confidence: float [0.0 to 1.0]
  - impact_level: enum [high, medium, low]
  - sources: array[string]
  - event_summary: string
  - llm_reasoning: string (full LLM reasoning trace)
  - url: string
  - timestamp: timestamp
```

**3. `trade_signals` (Investment Agent Output)**
```
Topic: trade_signals
Partitioned by: ticker
Message Type:
  - ticker: string
  - action: enum [BUY, SELL, HOLD]
  - confidence: float [0.0 to 1.0]
  - size: float (position size in units or %)
  - entry_price: float
  - stop_loss: float
  - take_profit: float
  - signal_analysis: string (LLM reasoning about signal fusion)
  - risk_factors: array[string]
  - reasoning_trace: string
  - timestamp: timestamp
```

**4. `validated_trades` (Personality Agent Output)**
```
Topic: validated_trades
Partitioned by: ticker
Message Type:
  - trade_signal_id: uuid
  - ticker: string
  - action: enum [BUY, SELL, HOLD]
  - confidence_original: float
  - confidence_adjusted: float
  - mode: string (buffett, soros, cathie, contrarian)
  - persona_reasoning: string (how persona analyzed trade)
  - final_decision: enum [BUY, SELL, HOLD]
  - mode_recommendation: "accept"|"veto"|"reduce_size"
  - reasoning_trace: string
  - timestamp: timestamp
```

**5. `executed_trades` (Broker Agent Output)**
```
Topic: executed_trades
Partitioned by: ticker
Message Type:
  - order_id: string (Binance order ID)
  - ticker: string
  - action: enum [BUY, SELL]
  - size: float
  - entry_price: float
  - fee: float
  - status: enum [filled, partial, rejected]
  - timestamp: timestamp
```

---

## 🧭 Personality Modes (LLM-based)

Each mode is defined by a **system prompt** that guides the LLM's reasoning in the Personality Agent.

### Mode 1: Buffett (Value Investor)

**Philosophy:** Long-term value, margin of safety, fundamentals focus, resist hype.

**Persona System Prompt:**
```
You are Warren Buffett analyzing a potential investment. Your principles:
1. Look for businesses with durable competitive advantages (moats)
2. Demand a margin of safety (buy when price is 30-50% below intrinsic value)
3. Ignore short-term noise; focus on long-term fundamentals
4. Avoid speculative or trendy plays
5. Prefer simple, understandable businesses
6. Strong balance sheet, predictable cash flows

Given the trade signal above:
- Does this company have a moat? Is it simple to understand?
- Is there a margin of safety in the current price?
- Is the trade a speculative play or fundamentals-driven?
- How would you adjust confidence based on these factors?
```

**Confidence Adjustments (LLM determines these):**
- Reduce confidence if: price is at all-time highs, RSI > 70, speculative sector
- Boost confidence if: price down 20%+ from highs, strong fundamentals, margin of safety

---

### Mode 2: Soros (Macro/Momentum)

**Philosophy:** Reflexivity, macro signals, market dynamics, trend-following, exploiting mispricings.

**Persona System Prompt:**
```
You are George Soros analyzing market dynamics and reflexivity. Your approach:
1. Identify inflection points where market perception shifts
2. Follow momentum and price trends (not fight them)
3. React to macro signals: Fed policy, inflation, geopolitical events
4. Exploit market overreactions and herd behavior
5. Exit before the trend reverses

Given the trade signal above:
- Is this a trend reversal or continuation of an existing trend?
- What macro backdrop supports or contradicts this trade?
- Is the market overreacting, creating opportunity?
- How would you adjust confidence and position size?
```

**Confidence Adjustments (LLM determines these):**
- Boost confidence if: volume spike, breakout above 20d high, positive macro catalyst
- Reduce confidence if: trend exhaustion signals, contradicts macro backdrop

---

### Mode 3: Cathie (Innovation-Focused)

**Philosophy:** Tech disruption, biotech, emerging trends, growth-first, disruption thesis.

**Persona System Prompt:**
```
You are Cathie Wood analyzing disruptive innovation themes. Your focus:
1. Identify companies at the forefront of major disruptions (AI, biotech, robotics, energy)
2. Long-term growth potential over near-term profitability
3. Market may underappreciate innovation theses
4. Higher volatility tolerance for high-conviction growth

Given the trade signal above:
- Does this company operate in a disruption theme (AI, blockchain, biotech, renewable)?
- Is the company a leader or innovator in its space?
- What's the long-term TAM (total addressable market)?
- How would you adjust confidence based on innovation potential?
```

**Confidence Adjustments (LLM determines these):**
- Boost confidence if: AI/innovation-related news, disruptive company, high growth
- Reduce confidence if: mature/traditional sector, declining industry

---

### Mode 4: Contrarian

**Philosophy:** Inverse crowd, anti-sentiment, fade consensus, find value in fear.

**Persona System Prompt:**
```
You are a contrarian investor betting against consensus. Your approach:
1. When the crowd is extremely bullish, look for exit signals
2. When the crowd is extremely bearish, look for entry opportunities
3. Find mispricings created by emotional selling
4. Exploit herd behavior

Given the trade signal above:
- What's the mainstream sentiment? (bullish/bearish/neutral)
- How extreme is the sentiment (on a scale 1-10)?
- Does the fundamentals contradict the sentiment?
- Would you increase or decrease confidence based on contrarian positioning?
```

**Confidence Adjustments (LLM determines these):**
- Boost confidence if: market is extremely bearish but fundamentals are OK
- Reduce confidence if: market is euphoric, crowd is all in one direction

---

## 📊 MVP Scope & Constraints

### In MVP ✅

| Component | Scope |
|-----------|-------|
| Asset Classes | Crypto (BTC, ETH) — 24/7 markets, fast feedback |
| News Sources | Reddit, Twitter, CoinTelegraph, NewsAPI |
| LLM Reasoning | Claude or OpenAI (not local models for quality) |
| Agents | News → Investment → Personality → Broker (all LangGraph) |
| Personality Modes | Buffett, Soros, Cathie, Contrarian (LLM-based personas) |
| Trading Mode | 4-hour candles (not pure 1-min day trading) |
| Broker | Binance paper trading (no real money) |
| Backtesting | Walk-forward on 12 months historical data |
| Dashboard | Streamlit (live metrics, agent reasoning traces) |
| Data Storage | SQLite + Redis + LanceDB (local) |
| Research Agent | Optional; LLM reasoning + Parallel API on large trades |

### Out of MVP ❌ (Phase 2+)

- [ ] Options trading
- [ ] Real-time 1-minute candles
- [ ] Multiple asset classes (stocks, forex, commodities)
- [ ] RL feedback loop for signal weight optimization
- [ ] Distributed deployment (Kubernetes)
- [ ] LLM fine-tuning on historical trading data
- [ ] Multi-model ensemble (combining Claude + GPT-4)
- [ ] Real money trading (staying paper-only)

---

## 📁 Project Structure

```
ai-trading-system/
├── README.md                          # This file
├── package.json                       # Node.js dependencies
├── tsconfig.json                      # TypeScript config
├── .env.example                       # Environment variables template
├── config/
│   ├── settings.ts                    # API keys, Kafka config, LLM settings
│   ├── personalities.ts               # Persona system prompts
│   └── kafka_schemas.ts               # Zod schema definitions for Kafka topics
├── docker/
│   └── docker-compose.yml             # Kafka + Zookeeper + Redis + LanceDB
├── src/
│   ├── agents/
│   │   ├── base_agent.ts              # Abstract LangGraph agent class
│   │   ├── news_agent.ts              # LangGraph state graph for news processing
│   │   ├── investment_agent.ts        # LangGraph state graph for signal fusion
│   │   ├── personality_agent.ts       # LangGraph state graph for persona filtering
│   │   ├── broker_agent.ts            # LangGraph for order execution
│   │   └── research_agent.ts          # Optional: Parallel API + LLM research
│   ├── tools/
│   │   ├── sentiment_analyzer.ts      # LLM tool: sentiment analysis
│   │   ├── quant_calculator.ts        # LLM tool: RSI, SMA, volume calculations
│   │   ├── deduplicator.ts            # LLM tool: event deduplication
│   │   ├── portfolio_validator.ts     # LLM tool: risk checks
│   │   ├── parallel_research.ts       # LLM tool: call Parallel API
│   │   └── historical_lookup.ts       # LLM tool: fetch historical patterns
│   ├── infrastructure/
│   │   ├── kafka_integration.ts       # Kafka producer/consumer helpers
│   │   ├── llm_client.ts              # Claude/OpenAI LLM client wrapper
│   │   ├── state_store.ts             # Redis for mode + context persistence
│   │   └── database.ts                # SQLite + LanceDB access
│   ├── services/
│   │   ├── binance_service.ts         # Binance REST API wrapper
│   │   ├── news_service.ts            # Reddit, Twitter, NewsAPI aggregators
│   │   ├── parallel_service.ts        # Parallel deep research API wrapper
│   │   └── embeddings_service.ts      # Sentence transformers for dedup
│   ├── types/
│   │   ├── kafka_messages.ts          # Zod types for Kafka messages
│   │   ├── agent_state.ts             # LangGraph state types
│   │   └── personalities.ts           # Persona type definitions
│   └── utils/
│       ├── logger.ts                  # Pino structured logging
│       ├── metrics.ts                 # Performance metric calculations
│       └── reasoning_tracer.ts        # Log LLM reasoning for debugging
├── backtest/
│   ├── backtest_engine.ts             # Walk-forward validation harness
│   ├── historical_data_loader.ts      # Load historical Binance data
│   └── signal_replay.ts               # Replay historical signals through agents
├── dashboard/
│   └── streamlit_app.py               # Streamlit live monitoring UI
├── tests/
│   ├── unit/
│   │   ├── news_agent.test.ts
│   │   ├── investment_agent.test.ts
│   │   └── personality_agent.test.ts
│   └── integration/
│       └── end_to_end.test.ts
├── scripts/
│   ├── setup_kafka.sh                 # Initialize Kafka + topics
│   ├── backtest.ts                    # Run backtest
│   └── run_live_trading.ts            # Start live paper trading
└── data/
    ├── trades.db                      # SQLite: trades, positions, metrics
    ├── lancedb/                       # LanceDB: news embeddings for dedup
    └── backtest_results/              # Historical validation results
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (TypeScript support)
- Docker & Docker Compose (for Kafka, Redis)
- Python 3.10+ (Streamlit dashboard only)
- API Keys:
  - Claude API (Anthropic) or OpenAI API
  - Binance API (paper trading)
  - Reddit app credentials (PRAW)
  - Twitter/X API credentials (tweepy for Node or axios calls)
  - Parallel AI API key (for research agent)

### Setup Steps (High-Level)

1. **Clone & Install**
   ```
   git clone <repo>
   cd ai-trading-system
   npm install
   python -m venv venv && source venv/bin/activate && pip install streamlit
   ```

2. **Configure Environment**
   ```
   cp .env.example .env
   # Edit .env with API keys, Kafka host, LLM model choice (claude-3-5-sonnet or gpt-4)
   ```

3. **Start Infrastructure**
   ```
   docker-compose -f docker/docker-compose.yml up -d
   bash scripts/setup_kafka.sh
   ```

4. **Start Agents (in separate terminals)**
   ```
   npx ts-node src/agents/news_agent.ts
   npx ts-node src/agents/investment_agent.ts
   npx ts-node src/agents/personality_agent.ts
   npx ts-node src/agents/broker_agent.ts
   ```

5. **Launch Dashboard**
   ```
   streamlit run dashboard/streamlit_app.py
   ```

6. **Backtest (Optional)**
   ```
   npx ts-node scripts/backtest.ts
   ```

---

## 📋 Phase 1: Detailed Step-by-Step Roadmap (3-4 Weeks)

**Goal:** Build, validate, and paper-trade the complete MVP system with all three agents working end-to-end.

---

### 🔧 STEP 0: Project Setup & Infrastructure (Day 1)

#### **Step 0.1: Create Project Structure**
- [ ] Initialize Node.js monorepo with `apps/backend` and `apps/dashboard`
- [ ] Setup TypeScript config for both
- [ ] Create `.gitignore`, `.env.example`
- [ ] Create folder structure as defined in README

**Checkpoint 0.1:**
```
✅ Run: npm install → no errors
✅ Run: npx tsc --noEmit → no TS errors
✅ Folder structure matches README
```

**Estimated Time:** 30 minutes

---

#### **Step 0.2: Docker Infrastructure (Kafka, Redis, LanceDB)**
- [ ] Create `docker/docker-compose.yml`
  - Kafka + Zookeeper
  - Redis
  - Optional: LanceDB (or use local)
- [ ] Test: `docker-compose up -d`
- [ ] Create Kafka topic setup script

**Checkpoint 0.2:**
```
✅ docker ps → all containers running
✅ kafka-topics list → topics exist
✅ redis-cli ping → PONG
```

**Estimated Time:** 45 minutes

---

#### **Step 0.3: Environment & Configuration**
- [ ] Create `config/settings.ts` with API keys, Kafka hosts
- [ ] Create `.env.example` template
- [ ] Setup logging with Pino

**Checkpoint 0.3:**
```
✅ cp .env.example .env
✅ npm run dev → reads .env without errors
✅ Logs show connection info
```

**Estimated Time:** 20 minutes

---

**🎯 End of Day 1 Checkpoint:**
```
Project is scaffolded, Docker is running, everything compiles.
No agents built yet, but foundation is solid.
Time invested: ~1.5 hours
```

---

### 🧠 STEP 1: Backend Core - LLM & Kafka Integration (Days 2-3)

#### **Step 1.1: LLM Client Wrapper**
- [ ] Create `src/infrastructure/llm_client.ts`
  - Wrapper for Claude or OpenAI API
  - Functions: `invoke()`, `invokeWithTools()`, `streamResponse()`
- [ ] Add error handling and retries
- [ ] Test: Call LLM with simple prompt

**Checkpoint 1.1:**
```
✅ npm run test:llm-client → LLM responds
✅ Response contains text/reasoning
✅ Error handling works (rate limit, timeout)
```

**Estimated Time:** 1 hour

---

#### **Step 1.2: Kafka Producer/Consumer Helpers**
- [ ] Create `src/infrastructure/kafka_producer.ts` (send messages to Kafka)
- [ ] Create `src/infrastructure/kafka_consumer.ts` (listen to topics)
- [ ] Add message validation with Zod schemas
- [ ] Test: Send test message, consume it

**Checkpoint 1.2:**
```
✅ npm run test:kafka-producer → message sent
✅ npm run test:kafka-consumer → message received
✅ Zod validation prevents invalid messages
```

**Estimated Time:** 1 hour

---

#### **Step 1.3: Base Agent Class (LangGraph)**
- [ ] Create `src/agents/base_agent.ts`
  - Abstract class with LangGraph state graph
  - Methods: `process()`, `run()`, `handleError()`
  - Setup Kafka consumer/producer
- [ ] Test: Create simple test agent that logs messages

**Checkpoint 1.3:**
```
✅ BaseAgent instantiates without errors
✅ Can attach Kafka topics (input/output)
✅ Mock agent processes test messages
```

**Estimated Time:** 1.5 hours

---

**🎯 End of Day 2-3 Checkpoint:**
```
Core infrastructure ready: LLM client, Kafka I/O, Base Agent class.
Ready to build specific agents.
Time invested: ~3.5 hours
```

---

### 📰 STEP 2: News Agent Implementation (Days 4-5)

#### **Step 2.1: News Sources Setup**
- [ ] Create `src/services/news_service.ts`
  - Implement `fetch_reddit_posts()` (PRAW)
  - Implement `fetch_twitter_posts()` (tweepy or axios)
  - Implement `fetch_newsapi()` (NewsAPI)
  - Implement `fetch_cointelegraph()` (RSS or web scrape)
- [ ] Test: Each source returns 5+ articles

**Checkpoint 2.1:**
```
✅ reddit.fetch() → 5+ posts with text
✅ twitter.fetch() → 5+ tweets
✅ newsapi.fetch() → 5+ articles
✅ All have: headline, URL, source, timestamp
```

**Estimated Time:** 1.5 hours

---

#### **Step 2.2: Deduplication Service**
- [ ] Create `src/services/deduplicator.ts`
  - Use `sentence-transformers` for embeddings
  - Store in LanceDB
  - Function: `isDuplicate(article)` → boolean
- [ ] Test: Feed same headline twice, get dedup flag

**Checkpoint 2.2:**
```
✅ Similar headlines detected as duplicates
✅ Different headlines NOT flagged as duplicates
✅ LanceDB stores embeddings correctly
```

**Estimated Time:** 1 hour

---

#### **Step 2.3: News Agent LLM Nodes**
- [ ] Create `src/agents/news_agent.ts` extending BaseAgent
- [ ] Implement 4 LangGraph nodes:
  1. **Deduplication Node** → LLM: "Are these articles about the same event?"
  2. **Event Extraction Node** → LLM: "What's the core event? Extract ticker."
  3. **Sentiment Analysis Node** → LLM: "Is sentiment bullish/bearish? Impact level?"
  4. **Signal Emission Node** → Emit to Kafka `processed_signals`
- [ ] Test: Feed 5 real news articles

**Checkpoint 2.3:**
```
✅ Agent processes 5 articles in < 30 seconds
✅ Sentiment scores are between -1 and 1
✅ Confidence scores are between 0 and 1
✅ Kafka messages valid (Zod validation passes)
✅ LLM reasoning traces logged to SQLite
```

**Estimated Time:** 2.5 hours

---

#### **Step 2.4: API Endpoint for Signals**
- [ ] Create `src/api/signals.ts` (Express route)
  - `GET /api/signals` → list recent signals from SQLite
  - `GET /api/signals/:id` → get full signal + reasoning
- [ ] Test: Curl endpoint, get signals

**Checkpoint 2.4:**
```
✅ GET /api/signals?limit=10 → returns array
✅ Each signal has: ticker, sentiment, confidence, timestamp
✅ Reasoning field contains full LLM trace
```

**Estimated Time:** 45 minutes

---

**🎯 End of Day 4-5 Checkpoint:**
```
News Agent is LIVE and producing signals.
Every signal has full LLM reasoning.
Time invested: ~5.5 hours
```

---

### 📊 STEP 3: Investment Agent Implementation (Days 6-7)

#### **Step 3.1: Quantitative Data Fetcher**
- [ ] Create `src/services/binance_service.ts`
  - Function: `fetch_ohlcv(ticker, timeframe)` → Binance API
  - Calculate: RSI(14), SMA(20/50), volume spike, momentum
- [ ] Test: Fetch BTC 4h candles, calculate indicators

**Checkpoint 3.1:**
```
✅ Binance API returns OHLCV data
✅ RSI calculated correctly (should be 0-100)
✅ SMA 20/50 crossover detected
✅ Volume spike detection works
```

**Estimated Time:** 1 hour

---

#### **Step 3.2: Signal Fusion Engine**
- [ ] Create `src/models/signal_calculator.ts`
  - Function: `fuse_signals()` → combine sentiment + quant
  - Weights: 40% sentiment, 30% RSI, 20% volume, 10% SMA
  - Output: single confidence score
- [ ] Test: Feed sentiment + quant data, get fused score

**Checkpoint 3.2:**
```
✅ fuse_signals(sentiment=0.8, rsi=58, volume_spike=true) → 0.6-0.8 confidence
✅ Score is deterministic (same input → same output)
✅ Weights impact final score
```

**Estimated Time:** 1 hour

---

#### **Step 3.3: Investment Agent LLM Nodes**
- [ ] Create `src/agents/investment_agent.ts` extending BaseAgent
- [ ] Implement 4 LangGraph nodes:
  1. **Signal Collection** → Read from Kafka `processed_signals`, fetch quant data
  2. **Signal Fusion** → LLM: "How do these signals align? Any contradictions?"
  3. **Trade Recommendation** → LLM: "BUY/SELL/HOLD? Confidence? Position size?"
  4. **Signal Emission** → Emit to Kafka `trade_signals`
- [ ] Test: Process 3 signals from News Agent

**Checkpoint 3.3:**
```
✅ Agent processes 3 signals in < 60 seconds
✅ Output: { action: "BUY"|"SELL"|"HOLD", confidence: 0-1 }
✅ Entry price, stop loss, take profit calculated
✅ Risk factors identified
✅ Kafka `trade_signals` topic receives messages
```

**Estimated Time:** 2.5 hours

---

#### **Step 3.4: API Endpoint for Trades (Pre-Execution)**
- [ ] Create `src/api/trade_signals.ts`
  - `GET /api/trade-signals` → list pending trades (not yet executed)
- [ ] Test: See trade recommendations before they're executed

**Checkpoint 3.4:**
```
✅ GET /api/trade-signals → returns pending trades
✅ Each has: ticker, action, confidence, reasoning
```

**Estimated Time:** 30 minutes

---

**🎯 End of Day 6-7 Checkpoint:**
```
Investment Agent is LIVE.
News signals → Investment reasoning → Trade recommendations.
Full pipeline from signal to trade decision working.
Time invested: ~5 hours
```

---

### 🎭 STEP 4: Personality Agent Implementation (Days 8-9)

#### **Step 4.1: Personality System Prompts**
- [ ] Create `src/config/personalities.ts`
  - Define 4 system prompts (Buffett, Soros, Cathie, Contrarian)
  - Each has detailed persona description
- [ ] Store in Redis for runtime access
- [ ] Test: Load each persona, verify prompts

**Checkpoint 4.1:**
```
✅ Redis stores all 4 personas
✅ Can retrieve persona by name
✅ Prompts are clear and distinct
```

**Estimated Time:** 45 minutes

---

#### **Step 4.2: Mode Persistence**
- [ ] Create `src/infrastructure/state_store.ts` (Redis wrapper)
  - Function: `setMode(mode_name)` → persist to Redis
  - Function: `getMode()` → read from Redis
  - Default mode: "buffett"
- [ ] Test: Set mode, restart agent, verify mode persists

**Checkpoint 4.2:**
```
✅ setMode("soros") → Redis stores it
✅ App restart → getMode() returns "soros"
✅ API can read/write mode
```

**Estimated Time:** 45 minutes

---

#### **Step 4.3: Personality Agent LLM Nodes**
- [ ] Create `src/agents/personality_agent.ts` extending BaseAgent
- [ ] Implement 4 LangGraph nodes:
  1. **Load Persona** → Read mode from Redis, fetch system prompt
  2. **Persona Reasoning** → LLM: "[Persona] analyzes this trade. Thoughts?"
  3. **Decision Adjustment** → LLM: "Final decision: accept/veto/reduce?"
  4. **Validation Emission** → Emit to Kafka `validated_trades`
- [ ] Test: Process trade signal through all 4 personas

**Checkpoint 4.3:**
```
✅ Each persona produces different confidence adjustment
✅ Buffett reduces confidence if RSI > 70
✅ Soros boosts confidence on breakouts
✅ Cathie boosts on innovation keywords
✅ Contrarian inverts on extreme sentiment
✅ Kafka `validated_trades` receives messages
```

**Estimated Time:** 2 hours

---

#### **Step 4.4: Mode Switcher API**
- [ ] Create `src/api/settings.ts`
  - `GET /api/settings` → current mode + config
  - `POST /api/settings/mode` → switch mode
- [ ] Test: Switch between personas, verify behavior changes

**Checkpoint 4.4:**
```
✅ POST /api/settings/mode { mode: "soros" } → 200 OK
✅ New trades use Soros reasoning
✅ Existing positions unaffected
```

**Estimated Time:** 1 hour

---

**🎯 End of Day 8-9 Checkpoint:**
```
Personality Agent is LIVE.
User can switch between 4 investor personas.
Same signals → different decisions based on mode.
Time invested: ~4.5 hours
```

---

### 🤖 STEP 5: Broker Agent & Order Execution (Days 10-11)

#### **Step 5.1: Broker Agent Risk Checks**
- [ ] Create `src/agents/broker_agent.ts` extending BaseAgent
- [ ] Implement risk validation:
  - Position size < 10% of portfolio
  - Max leverage < 2x
  - Max daily drawdown < 5%
  - Portfolio correlation < 0.8
- [ ] Test: Reject oversized trade, allow normal trade

**Checkpoint 5.1:**
```
✅ Oversized trade rejected (veto with reason)
✅ Normal trade approved
✅ Error logged and sent to Kafka (dead-letter topic)
```

**Estimated Time:** 1.5 hours

---

#### **Step 5.2: Binance Paper Trading Integration**
- [ ] Create `src/services/binance_paper_trading.ts`
  - Implement `place_order(ticker, action, size, price)` for paper mode
  - Track orders in SQLite (order_id, status, entry_price, etc.)
  - Simulate fills at current market price
- [ ] Test: Place BUY order, verify it's tracked in DB

**Checkpoint 5.2:**
```
✅ place_order("BTC", "BUY", 0.1, 43000) → order_id returned
✅ SQLite shows order: status="filled", entry_price=43000
✅ Order ID is valid UUID
```

**Estimated Time:** 1.5 hours

---

#### **Step 5.3: Position Tracking**
- [ ] Create `src/services/position_manager.ts`
  - Track open positions in SQLite: ticker, entry_price, size, mode
  - Calculate unrealized P&L in real-time
  - Update position when price changes
- [ ] Test: Open position, check unrealized P&L

**Checkpoint 5.3:**
```
✅ Open position in SQLite with: entry_price, size, timestamp, mode
✅ Current price fetched from Binance
✅ Unrealized P&L = (current_price - entry_price) * size
✅ Multiple open positions tracked separately
```

**Estimated Time:** 1 hour

---

#### **Step 5.4: Broker Agent Execution Flow**
- [ ] Consume from Kafka `validated_trades`
- [ ] Run risk checks
- [ ] Place order via Binance
- [ ] Track position in SQLite
- [ ] Emit to Kafka `executed_trades`
- [ ] Test: Full trade execution end-to-end

**Checkpoint 5.4:**
```
✅ Validated trade consumed
✅ Risk checks pass/fail
✅ Order placed on Binance paper trading
✅ Position created in SQLite
✅ executed_trades Kafka topic receives confirmation
```

**Estimated Time:** 1 hour

---

**🎯 End of Day 10-11 Checkpoint:**
```
Broker Agent is LIVE.
Full pipeline: News → Investment → Personality → Broker → Order → Position Tracking.
All 4 agents working end-to-end!
Time invested: ~5 hours
```

---

### 📡 STEP 6: Backend API & WebSocket (Days 12-13)

#### **Step 6.1: Dashboard API Endpoints**
- [ ] Create `src/api/dashboard.ts`
  - `GET /api/dashboard` → portfolio summary, metrics, recent trades, agent status
- [ ] Create `src/api/trades.ts` → GET /api/trades (list all)
- [ ] Create `src/api/positions.ts` → GET /api/positions (current)
- [ ] Test: All endpoints return valid JSON

**Checkpoint 6.1:**
```
✅ GET /api/dashboard → { portfolio, metrics, recentTrades, agentStatus }
✅ GET /api/trades?limit=10 → array of trades
✅ GET /api/positions → current positions with unrealized P&L
```

**Estimated Time:** 1.5 hours

---

#### **Step 6.2: WebSocket Setup**
- [ ] Create `src/infrastructure/websocket_server.ts`
  - Listen to Kafka topics (executed_trades, processed_signals, position updates)
  - Broadcast to connected clients
- [ ] Setup Socket.io on Express
- [ ] Test: Connect WebSocket client, receive live updates

**Checkpoint 6.2:**
```
✅ WebSocket server starts without errors
✅ Client connects: ws://localhost:3000/ws
✅ New trade → broadcasts to all clients in < 100ms
✅ Message format: { type: "trade_executed", data: {...} }
```

**Estimated Time:** 1.5 hours

---

#### **Step 6.3: Backend Server Setup**
- [ ] Create `src/main.ts` (Express entry point)
  - Setup routes, middleware, error handling
  - Start API server on port 3000
  - Start WebSocket server
- [ ] Test: `npm run start` → server runs

**Checkpoint 6.3:**
```
✅ npm run start → server starts
✅ curl http://localhost:3000/api/dashboard → 200 OK
✅ WebSocket available at ws://localhost:3000/ws
```

**Estimated Time:** 1 hour

---

**🎯 End of Day 12-13 Checkpoint:**
```
Backend is feature-complete!
All APIs working, WebSocket streaming live data.
Ready for frontend to connect.
Time invested: ~4 hours
```

---

### 🎨 STEP 7: Frontend Setup & Dashboard Page (Days 14-15)

#### **Step 7.1: Next.js Project Setup**
- [ ] Create Next.js project in `apps/dashboard`
- [ ] Install: Shadcn/ui, TailwindCSS, Recharts, React Query, Socket.io
- [ ] Setup TypeScript, eslint, prettier
- [ ] Test: `npm run dev` → app runs on localhost:3001

**Checkpoint 7.1:**
```
✅ Next.js app compiles without errors
✅ Shadcn/ui components available
✅ Tailwind CSS working
✅ Development server running
```

**Estimated Time:** 1.5 hours

---

#### **Step 7.2: Layout Components**
- [ ] Create `components/layout/Header.tsx` (top nav)
- [ ] Create `components/layout/Sidebar.tsx` (left nav with links)
- [ ] Create root `app/layout.tsx` (wraps all pages)
- [ ] Test: Sidebar and header visible on all pages

**Checkpoint 7.2:**
```
✅ Header displays app title + current mode
✅ Sidebar has links: Dashboard, Trades, Positions, Signals, Settings
✅ Active link highlighted
```

**Estimated Time:** 1 hour

---

#### **Step 7.3: Dashboard Widgets**
- [ ] Create `components/dashboard/PortfolioCard.tsx` (P&L summary)
- [ ] Create `components/dashboard/MetricsCard.tsx` (Sharpe, win rate)
- [ ] Create `components/dashboard/AgentStatusWidget.tsx` (agent health)
- [ ] Create `components/dashboard/RecentTradesWidget.tsx` (last 5 trades)
- [ ] Test: Widgets render without data (static mockups)

**Checkpoint 7.3:**
```
✅ All widgets render on page
✅ Widgets have placeholder data
✅ Layout looks clean (Shadcn/ui styling)
```

**Estimated Time:** 2 hours

---

#### **Step 7.4: API Client & Data Fetching**
- [ ] Create `lib/api-client.ts` (fetch wrapper)
- [ ] Create `hooks/useDashboard.ts` (React Query for dashboard data)
- [ ] Connect Dashboard page to backend
- [ ] Test: Fetch real data from backend

**Checkpoint 7.4:**
```
✅ useDashboard() hook fetches dashboard data
✅ Portfolio card shows real total balance
✅ Recent trades populated from database
✅ Metrics show calculated Sharpe, win rate
```

**Estimated Time:** 1.5 hours

---

#### **Step 7.5: Dashboard Home Page**
- [ ] Create `app/page.tsx` (main dashboard)
- [ ] Assemble all widgets
- [ ] Add basic styling
- [ ] Test: Page loads, shows real data

**Checkpoint 7.5:**
```
✅ Dashboard page loads without errors
✅ All 5 widgets visible
✅ Real backend data displayed
✅ Page refreshes on manual reload
```

**Estimated Time:** 1 hour

---

**🎯 End of Day 14-15 Checkpoint:**
```
Frontend dashboard page LIVE with real backend data.
User can see portfolio, metrics, recent trades.
Time invested: ~7.5 hours
```

---

### 📈 STEP 8: WebSocket Real-Time Updates (Days 16-17)

#### **Step 8.1: WebSocket Client Hook**
- [ ] Create `hooks/useWebSocket.ts`
  - Connect to `ws://localhost:3000/ws`
  - Listen for: trade_executed, position_update, signal_received, metrics_update
  - Auto-reconnect on disconnect
- [ ] Test: Console logs incoming WebSocket messages

**Checkpoint 8.1:**
```
✅ WebSocket connects: ws://... 
✅ Receives: { type: "trade_executed", data: {...} }
✅ Console shows incoming messages
✅ Auto-reconnects after 5-second disconnect
```

**Estimated Time:** 1 hour

---

#### **Step 8.2: Real-Time Dashboard Updates**
- [ ] Modify `components/dashboard/RecentTradesWidget.tsx`
  - Subscribe to `trade_executed` via WebSocket
  - New trades appear at top of list without refresh
- [ ] Modify `components/dashboard/MetricsCard.tsx`
  - Subscribe to `metrics_update`
  - P&L updates in real-time
- [ ] Test: Open dashboard, watch trades appear live

**Checkpoint 8.2:**
```
✅ Place order via CLI on backend
✅ Dashboard instantly shows new trade (no refresh needed)
✅ P&L updates every 2-5 seconds
✅ Portfolio card updates with new balance
```

**Estimated Time:** 1.5 hours

---

#### **Step 8.3: Trades History Page**
- [ ] Create `app/trades/page.tsx`
- [ ] Create `components/trades/TradesTable.tsx` (sortable, filterable)
- [ ] Create `components/trades/TradeDetailsModal.tsx` (click row → full details + reasoning)
- [ ] Connect to `/api/trades` endpoint
- [ ] Test: List all trades, click to see full reasoning

**Checkpoint 8.3:**
```
✅ Trades table loads 20 rows
✅ Click row → modal shows full trade details
✅ Modal displays full LLM reasoning from all agents
✅ Table sortable by any column
```

**Estimated Time:** 2 hours

---

#### **Step 8.4: Live Signals Page**
- [ ] Create `app/signals/page.tsx`
- [ ] Create `components/signals/SignalsTable.tsx` (real-time stream)
- [ ] Subscribe to WebSocket `signal_received`
- [ ] New signals appear at top
- [ ] Color coding (green = bullish, red = bearish, yellow = hold)
- [ ] Test: Watch signals stream live as News Agent processes articles

**Checkpoint 8.4:**
```
✅ Signals page opens
✅ New signals appear in real-time (WebSocket)
✅ Signals color-coded by sentiment
✅ Can expand row to see LLM reasoning
✅ Filters by ticker, agent, signal type work
```

**Estimated Time:** 2 hours

---

**🎯 End of Day 16-17 Checkpoint:**
```
Frontend is LIVE and reactive!
Real-time updates flowing from backend via WebSocket.
Time invested: ~6.5 hours
```

---

### ⚙️ STEP 9: Remaining Pages & Settings (Days 18-19)

#### **Step 9.1: Positions Page**
- [ ] Create `app/positions/page.tsx`
- [ ] Create `components/positions/PositionsTable.tsx`
- [ ] Real-time P&L updates via WebSocket
- [ ] Quick actions: close position, adjust stops
- [ ] Test: See current positions with live P&L

**Checkpoint 9.1:**
```
✅ Positions page loads
✅ Shows all open positions with entry/current price
✅ Unrealized P&L updates every 2-5 seconds
✅ Close position button works
```

**Estimated Time:** 1.5 hours

---

#### **Step 9.2: Settings Page**
- [ ] Create `app/settings/page.tsx`
- [ ] Create `components/settings/ModeSelector.tsx` (Buffett/Soros/Cathie/Contrarian)
- [ ] Create `components/settings/AgentMonitor.tsx` (agent status + logs)
- [ ] Connect to `/api/settings` endpoints
- [ ] Test: Switch modes, see status changes

**Checkpoint 9.2:**
```
✅ Settings page loads
✅ Mode selector shows 4 options
✅ Switch mode → persists to backend (Redis)
✅ Agent status shows real-time health
✅ System logs visible
```

**Estimated Time:** 1.5 hours

---

#### **Step 9.3: Error Handling & Loading States**
- [ ] Add error boundaries to all pages
- [ ] Add loading spinners during data fetch
- [ ] Handle WebSocket disconnects gracefully
- [ ] Show toast notifications for errors/success
- [ ] Test: Simulate network errors, see graceful handling

**Checkpoint 9.3:**
```
✅ Network error → shows error toast
✅ Slow load → loading spinner appears
✅ WebSocket disconnects → shows "reconnecting..." message
✅ No console errors
```

**Estimated Time:** 1 hour

---

**🎯 End of Day 18-19 Checkpoint:**
```
Frontend feature-complete!
All 5 pages working: Dashboard, Trades, Positions, Signals, Settings.
Real-time updates flowing smoothly.
Time invested: ~4 hours
```

---

### 🧪 STEP 10: Integration Testing & Validation (Days 20-21)

#### **Step 10.1: End-to-End Test (Full Pipeline)**
- [ ] Start all backend agents
- [ ] Manually post news article to Kafka `raw_news`
- [ ] Watch pipeline: News Agent → Investment Agent → Personality Agent → Broker Agent
- [ ] Verify trade appears in dashboard in real-time
- [ ] Test with 3 different news items + 3 different modes

**Checkpoint 10.1:**
```
✅ Post article to Kafka
✅ News Agent processes (sentiment + dedup)
✅ Investment Agent generates trade signal
✅ Personality Agent adjusts confidence
✅ Broker Agent places order
✅ Dashboard shows new trade in < 10 seconds
✅ All LLM reasoning traces logged and visible in UI
```

**Estimated Time:** 2 hours

---

#### **Step 10.2: Error Handling & Recovery**
- [ ] Test: Stop an agent, verify error shown in settings
- [ ] Test: Restart agent, system recovers
- [ ] Test: Invalid Kafka message (bad format) → dead-letter queue
- [ ] Test: LLM API timeout → retry + backoff
- [ ] Verify: All errors logged to SQLite + visible in debug page

**Checkpoint 10.2:**
```
✅ Agent failure detected within 10 seconds
✅ Dashboard shows 🔴 for failed agent
✅ Restart agent → system recovers
✅ Dead-letter queue contains failed messages
✅ Logs searchable and timestamped
```

**Estimated Time:** 1.5 hours

---

#### **Step 10.3: Performance Baseline**
- [ ] Measure: Signal latency (news → trade decision)
  - Target: < 5 minutes end-to-end
- [ ] Measure: Dashboard update latency
  - Target: < 1 second after trade execution
- [ ] Measure: API response times
  - Target: < 500ms for dashboard, signals
- [ ] Document baseline metrics

**Checkpoint 10.3:**
```
✅ News → Trade decision latency: 2-4 minutes
✅ Trade appears on dashboard: 0.5 seconds
✅ API responds in < 300ms
✅ WebSocket broadcasts in < 100ms
```

**Estimated Time:** 1 hour

---

**🎯 End of Day 20-21 Checkpoint:**
```
MVP is stable and tested!
All components integrated and working together.
Ready for paper trading validation.
Time invested: ~4.5 hours
```

---

### 📊 STEP 11: Paper Trading Validation (Days 22-28: 1 Week Live)

#### **Step 11.1: Paper Trading Start**
- [ ] Start all agents
- [ ] Run live for 24 hours, monitor for errors
- [ ] Collect initial metrics

**Checkpoint 11.1:**
```
✅ No crashes in 24 hours
✅ All agents processing signals
✅ Orders executing on Binance paper account
✅ Dashboard stable and responsive
```

**Estimated Time:** 1 day observation

---

#### **Step 11.2: Daily Metrics Tracking**
- [ ] Track daily: # trades, win rate, P&L, Sharpe ratio
- [ ] End of Week 1:
  - Total trades: 10+
  - Win rate: 50%+?
  - Sharpe ratio: > 0.5?
  - Max drawdown: < 15%?

**Checkpoint 11.2:**
```
✅ If metrics are green (Sharpe > 0.5, win rate > 50%):
   → Concept is validated! Move to Phase 2.
   
✅ If metrics are yellow (mixed results):
   → Debug which agent is underperforming.
   → Tune LLM prompts or signal weights.
   → Run another week.
   
❌ If metrics are red (Sharpe < 0.3, win rate < 40%):
   → Revisit agent reasoning and LLM prompts.
   → Check for signal lag or over-trading.
   → Retry after fixes.
```

**Estimated Time:** 1 week observation + analysis

---

**🎯 End of Week (Days 22-28):**
```
Phase 1 MVP complete!
Live paper trading data collected.
Decision point: Phase 2 or debug?
Time invested: ~55 hours total
```

---

## 📋 Phase 1 Checkpoint Summary

| Day(s) | Step | What Gets Built | Checkpoint |
|--------|------|-----------------|-----------|
| 1 | 0 | Project structure + Docker | Infrastructure ready |
| 2-3 | 1 | LLM client + Kafka + Base Agent | Core utilities working |
| 4-5 | 2 | News Agent + API | First agent live, signals flowing |
| 6-7 | 3 | Investment Agent | Signal fusion working |
| 8-9 | 4 | Personality Agent + Mode switching | All 3 agents integrated |
| 10-11 | 5 | Broker Agent + Order execution | Full pipeline working! |
| 12-13 | 6 | Backend API + WebSocket | Backend feature-complete |
| 14-15 | 7 | Dashboard page + widgets | Frontend MVP page live |
| 16-17 | 8 | Real-time updates | WebSocket streaming |
| 18-19 | 9 | Remaining pages + settings | Frontend complete |
| 20-21 | 10 | E2E testing + validation | System stable |
| 22-28 | 11 | Paper trading week | Metrics collected |

**Total: ~55 hours over 4 weeks**

---

## ✅ How to Use This Roadmap

1. **Pick a step** (e.g., Step 2.1: News Sources)
2. **Build it** (1-2 hours usually)
3. **Hit the checkpoint** (test it)
4. **Celebrate!** ✅ (checkpoint passed)
5. **Move to next step**

Each step has:
- Clear deliverables
- Specific test criteria
- Estimated time
- No surprises!

---

## 🚨 If You Get Stuck

For any step:
1. Check the checkpoint criteria (did you meet all of them?)
2. Re-read the step description
3. Check existing code examples (check similar files already built)
4. Test each piece independently before combining
5. If stuck >30 min, document the issue and move on (return later)

---

**Ready to start? Pick Step 0.1 and let's go!** 🚀

---

## 🧠 LLM Reasoning Visibility

One key feature of this MVP: **trace LLM reasoning for every decision**. Each agent logs:
- Input data (signals, context)
- LLM system prompt used
- LLM response (reasoning, analysis)
- Final decision made
- Confidence and adjustments

This is logged to SQLite and displayed in Streamlit for debugging and validation.

---

## 📈 Future Phases

### Phase 2: Hybrid Reasoning & Tool Improvement
- [ ] Add more sophisticated LLM tools (e.g., sector comparison, insider buying analysis)
- [ ] Implement dynamic persona weighting (blend modes based on market regime)
- [ ] Add RL-based feedback: learn from trade outcomes, improve prompts

### Phase 3: Multi-Asset & Advanced Reasoning
- [ ] Expand to US large-cap stocks
- [ ] Add options (covered calls, protective puts)
- [ ] Multi-model reasoning (ensemble of Claude + GPT-4 for better accuracy)

### Phase 4: Production Hardening
- [ ] Distributed deployment (Kubernetes)
- [ ] Real-time monitoring & alerting
- [ ] LLM fine-tuning on historical trading data
- [ ] Advanced risk management (correlation hedging, dynamic position sizing)

### Phase 5: Autonomous Learning
- [ ] Store all trades + LLM reasoning in vector DB
- [ ] Continuous prompt optimization based on performance
- [ ] Learn when to switch personas automatically based on market regime

---

## 📋 Frontend Architecture

### Technology Stack for UI/Dashboard

| Layer | Tool | Purpose | Why |
|-------|------|---------|-----|
| **Framework** | Next.js 14+ (App Router) | Full-stack React + routing | Type-safe, fast, production-grade |
| **UI Library** | Shadcn/ui + TailwindCSS | Component library + styling | Beautiful, accessible, zero-config |
| **Real-Time Updates** | WebSocket (Socket.io) | Live signals, P&L streaming | Low-latency, efficient |
| **Charts** | Recharts | Financial charts & graphs | Built for trading data |
| **State Management** | TanStack Query (React Query) | Server state sync | Handles real-time updates cleanly |
| **Tables** | TanStack Table | Trade history, positions | Sortable, filterable, responsive |
| **Notifications** | Sonner | Trade alerts, system notifications | Toast UI for events |
| **Backend API** | Express/NestJS (same TypeScript codebase) | REST + WebSocket endpoints | Seamless integration |

---

### Frontend Architecture Flow

```
┌─────────────────────────────────────────────────────────────┐
│  BACKEND (Node.js/LangGraph Agents)                         │
│  ├─ News Agent → Kafka processed_signals                    │
│  ├─ Investment Agent → Kafka trade_signals                  │
│  ├─ Personality Agent → Kafka validated_trades             │
│  └─ Broker Agent → Kafka executed_trades                   │
│     ↓                                                       │
│  Backend API Server (Express/NestJS)                       │
│  ├─ REST endpoints: /api/trades, /api/positions, etc.      │
│  ├─ WebSocket: /ws/live (real-time updates)               │
│  └─ Kafka Consumer: subscribes to all topics              │
└─────────────────────────────────────────────────────────────┘
                        ↓ WebSocket
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND (Next.js React Dashboard)                         │
│  ├─ Dashboard Page (P&L, Portfolio, Recent Trades)         │
│  ├─ Live Signals Page (Real-time signal stream)            │
│  ├─ Trades History Page (Search, filter, view reasoning)   │
│  ├─ Positions Page (Current holdings, unrealized P&L)      │
│  ├─ Settings Page (Mode switcher, config)                  │
│  └─ Agent Debug Page (Reasoning traces, logs)              │
│     ↓                                                       │
│  WebSocket Connection                                       │
│  ├─ Listens: executed_trades, signals, position updates   │
│  └─ Updates: Real-time charts, tables, metrics            │
└─────────────────────────────────────────────────────────────┘
```

---

### Frontend Features (MVP)

#### **1. Dashboard Home Page**

**Purpose:** At-a-glance overview of trading system status and performance.

**Components:**
- **Portfolio Summary Card**
  - Total balance (USD equivalent)
  - Today's P&L (absolute + %)
  - All-time P&L
  
- **Portfolio Allocation Chart**
  - Pie chart: BTC %, ETH %, USD cash %
  - Holdings summary
  
- **Performance Metrics Widget**
  - Sharpe ratio (risk-adjusted returns)
  - Win rate (% profitable trades)
  - Max drawdown (worst peak-to-trough)
  - Profit factor (avg win / avg loss)
  - Total trades (lifetime)
  
- **Current Mode Display**
  - Active personality mode (Buffett/Soros/Cathie/Contrarian)
  - Quick mode switcher button
  - Mode description tooltip
  
- **Agent Status Panel**
  - 🟢/🔴 status for each agent (News, Investment, Personality, Broker)
  - Last heartbeat timestamp
  - Error indicator if agent down
  
- **Recent Trades Widget**
  - Last 5 trades (newest first)
  - Columns: Ticker | Action | Entry | Current | P&L | Timestamp
  - Expandable rows → view full LLM reasoning
  - Color-coded (green = profit, red = loss)
  
- **Live Signals Widget**
  - Last 3-5 signals being processed
  - Real-time updates via WebSocket
  - Shows sentiment score, confidence, impact level

**Real-Time Updates:** WebSocket subscription to `executed_trades`, `processed_signals`, position updates (every 2-5 sec)

---

#### **2. Live Signals Page**

**Purpose:** Monitor real-time news sentiment processing and investment reasoning.

**Components:**
- **Signals Stream Table**
  - Columns: Timestamp | Agent | Ticker | Sentiment | Confidence | Signal Type | Status
  - Newest first (reverse chronological)
  - Rows color-coded: Green (bullish), Red (bearish), Yellow (neutral/hold)
  - Expandable rows → show full LLM reasoning trace
  
- **Filters**
  - By ticker (BTC, ETH, etc.)
  - By agent (News Agent, Investment Agent, Personality Agent)
  - By signal type (BUY, SELL, HOLD)
  - By confidence (threshold slider)
  
- **Reasoning Trace Modal (Expandable Row)**
  - Input data to agent
  - LLM system prompt used
  - Full LLM response / reasoning
  - Final decision + confidence
  - Applicable tools called
  
- **Signal Statistics**
  - Total signals in last hour / day
  - Sentiment distribution (bullish % / bearish % / neutral %)
  - Average confidence level
  - Most active ticker

**Real-Time Updates:** WebSocket to `processed_signals`, `trade_signals`, `validated_trades` topics

---

#### **3. Trades History Page**

**Purpose:** Browse, search, filter all historical trades with full reasoning traces.

**Components:**
- **Trades Data Table**
  - Columns: Order ID | Ticker | Action | Entry Price | Exit Price | Size | Entry Time | Exit Time | P&L | Mode | Status
  - Sortable by any column
  - Filterable by ticker, mode, status
  - Searchable by order ID
  - Pagination (20 rows/page)
  
- **Trade Details Modal (Click Row)**
  - Order ID, ticker, action, entry/exit prices
  - Entry time, exit time, holding duration
  - Unrealized vs realized P&L
  - Mode trade was opened in
  - **Full reasoning trace:**
    - News signal that triggered trade
    - Investment agent's signal fusion reasoning
    - Personality agent's decision process
    - Broker agent's execution notes
  - Historical price chart at entry point
  - Exit reason (if closed)
  
- **Statistics Panel**
  - Total trades (lifetime)
  - Win rate
  - Average win / Average loss
  - Largest win / Largest loss
  - Trades by mode (Buffett: X, Soros: Y, etc.)
  
- **Filters & Search**
  - By date range
  - By ticker
  - By mode
  - By status (open, closed)
  - Profitable vs unprofitable only

**Data Source:** API endpoint `/api/trades` with pagination + filters. Real-time updates via WebSocket for new trades.

---

#### **4. Positions Page**

**Purpose:** View current open positions and unrealized P&L.

**Components:**
- **Positions Table / Card View**
  - Columns (if table): Ticker | Entry Price | Current Price | Size | Unrealized P&L | Entry Time | Mode | Actions
  - Alternative card view: one card per position
  - Color-coded (green = profit, red = loss)
  - Real-time price updates via WebSocket
  
- **Position Details Card (Click Row/Card)**
  - Ticker details
  - Entry signal (link to that trade)
  - Current sentiment for this ticker
  - Entry price, current price, change %
  - Position size (units + USD value)
  - Unrealized P&L (USD + %)
  - Entry time, days held
  - Mode opened in
  - Stop loss / Take profit targets (if set)
  
- **Quick Actions** (buttons on each position)
  - Close position (market order)
  - Adjust stop loss / take profit
  - Add to position
  - View reasoning (link to LLM trace)
  
- **Portfolio Summary**
  - Total open positions
  - Total unrealized P&L
  - Portfolio concentration (largest position %)
  - Average entry price vs current price

**Real-Time Updates:** WebSocket to position P&L changes, current prices, sentiment updates (every 2-5 sec)

---

#### **5. Settings Page**

**Purpose:** Configure trading system and view agent status.

**Components:**
- **Mode Selector**
  - Radio buttons or segmented control: Buffett | Soros | Cathie | Contrarian
  - Description of each mode
  - "Switch Mode" button (affects only new trades, not existing positions)
  - Display current mode highlight
  
- **Portfolio Configuration**
  - Max position size (% of portfolio, e.g., 20%)
  - Max leverage ratio (e.g., 2x)
  - Max daily drawdown trigger (%, e.g., 5%)
  - Min confidence threshold for trades (e.g., 0.5)
  
- **Agent Monitoring**
  - Agent status table: Agent | Status | Last Heartbeat | Last Error
  - 🟢 Running | 🔴 Stopped | 🟡 Error
  - View logs button for each agent
  - Restart agent button
  
- **System Logs (Recent)**
  - Last 20 errors/warnings
  - Timestamp | Level | Agent | Message
  - Color-coded (red = error, yellow = warning, blue = info)
  
- **API Configuration** (if needed)
  - Test Kafka connection
  - Test Binance API
  - Test LLM API (Claude/OpenAI)

---

#### **6. Agent Reasoning Debugger (Internal Page)**

**Purpose:** Debug LLM reasoning traces, test prompts, inspect agent decisions.

**Components:**
- **Reasoning Traces Search/Filter**
  - List all recent LLM reasoning traces
  - Searchable by agent, ticker, timestamp
  - Filterable by agent type
  - Export traces as JSON
  
- **Trace Details (Expandable Row)**
  - Agent name
  - Input data (context, signals, quant data)
  - LLM system prompt used
  - LLM response (reasoning)
  - Tools called + results
  - Final decision + confidence
  - Timestamp
  
- **Manual LLM Testing** (textarea)
  - Input custom market data
  - Select agent to test
  - Submit → see LLM reasoning in real-time
  - Useful for prompt tuning

- **Agent Performance Trend**
  - Decision accuracy rate over time
  - Confidence calibration (is 80% confidence actually right 80% of the time?)
  - Signal lag (time from signal to trade)

---

### Backend API Endpoints (for Frontend)

```
Authentication (if needed):
GET    /api/auth/status          → { authenticated: boolean }

Dashboard:
GET    /api/dashboard             → { portfolio, metrics, recent_trades, agent_status }

Trades:
GET    /api/trades?limit=20&offset=0          → { trades: [...], total: number }
GET    /api/trades/:id            → { full trade details + reasoning }
POST   /api/trades/:id/close      → { order_id, status }

Positions:
GET    /api/positions             → { positions: [...], summary: {...} }
GET    /api/positions/:ticker     → { position details }
POST   /api/positions/:ticker/close → close position

Signals:
GET    /api/signals?limit=50      → { signals: [...], stats: {...} }
GET    /api/signals/:id           → { signal details + full trace }

Settings:
GET    /api/settings              → { mode, portfolio_config, api_status }
POST   /api/settings/mode         → { mode: "buffett" }
POST   /api/settings/config       → { max_position_size, max_leverage, etc. }

Agents:
GET    /api/agents/status         → { agents: [...], logs: [...] }
GET    /api/agents/:name/logs     → { logs: [...] }

Reasoning (Debug):
GET    /api/debug/reasoning?limit=100  → { traces: [...] }
GET    /api/debug/reasoning/:id        → { full trace details }
POST   /api/debug/test-llm             → test LLM reasoning

Real-Time WebSocket:
WS     /ws/live
       Subscribe messages:
       - "signals" → new signals from News Agent
       - "trades" → new trades from Broker Agent
       - "positions" → position P&L updates
       - "metrics" → portfolio metrics updates
       
       Server sends:
       { type: "signal", data: {...} }
       { type: "trade", data: {...} }
       { type: "position_update", data: {...} }
       { type: "metrics_update", data: {...} }
```

---

### Frontend Component Structure

```
Dashboard (Next.js App Router):
├── app/
│   ├── layout.tsx                    # Root layout with providers
│   ├── page.tsx                      # Dashboard home (/dashboard)
│   ├── trades/
│   │   ├── page.tsx                  # Trade history (/trades)
│   │   └── [id].tsx                  # Trade details (/trades/:id)
│   ├── positions/
│   │   └── page.tsx                  # Current positions (/positions)
│   ├── signals/
│   │   └── page.tsx                  # Live signals (/signals)
│   ├── settings/
│   │   └── page.tsx                  # Settings (/settings)
│   └── debug/
│       └── page.tsx                  # Reasoning debugger (/debug)

Components:
├── dashboard/
│   ├── PortfolioCard.tsx             # Portfolio summary + chart
│   ├── MetricsCard.tsx               # Sharpe, win rate, drawdown
│   ├── AgentStatusWidget.tsx         # Agent status indicators
│   ├── RecentTradesWidget.tsx        # Last 5 trades
│   └── LiveSignalsWidget.tsx         # Live signal feed
│
├── trades/
│   ├── TradesTable.tsx               # Trade history table
│   ├── TradeDetailsModal.tsx         # Full trade + reasoning
│   ├── ReasoningTraceView.tsx        # LLM reasoning display
│   └── TradeFilters.tsx              # Filters + search
│
├── positions/
│   ├── PositionsTable.tsx            # Current positions
│   ├── PositionCard.tsx              # Card view of position
│   ├── PositionDetailsModal.tsx      # Position details
│   └── QuickActionsMenu.tsx          # Close, adjust SL/TP
│
├── signals/
│   ├── SignalsTable.tsx              # Signal stream
│   ├── SignalFilters.tsx             # Filter by ticker, agent, type
│   └── ReasoningTraceModal.tsx       # Expand and view reasoning
│
├── settings/
│   ├── ModeSelector.tsx              # Buffett/Soros/Cathie/Contrarian picker
│   ├── PortfolioConfig.tsx           # Position sizing, leverage config
│   ├── AgentMonitor.tsx              # Agent status table
│   └── SystemLogs.tsx                # Recent errors/warnings
│
├── debug/
│   ├── ReasoningTraceBrowser.tsx     # Search & browse traces
│   ├── LLMTestPanel.tsx              # Manual LLM testing
│   └── PerformanceTrend.tsx          # Decision accuracy chart
│
├── layout/
│   ├── Header.tsx                    # Top navigation bar
│   ├── Sidebar.tsx                   # Left navigation
│   └── TopBar.tsx                    # Secondary info bar
│
└── ui/                               # Shadcn components
    ├── Button.tsx
    ├── Card.tsx
    ├── Table.tsx
    ├── Modal.tsx
    ├── Badge.tsx
    ├── Toast.tsx
    └── ... (all shadcn components)

Hooks:
├── useWebSocket.ts                   # WebSocket connection hook
├── useTradeHistory.ts                # Fetch trade history + filters
├── usePositions.ts                   # Fetch current positions
├── useSignals.ts                     # Subscribe to signals
├── useMetrics.ts                     # Fetch portfolio metrics
├── useDashboard.ts                   # Dashboard data aggregation
└── useReasoningTraces.ts             # Fetch LLM reasoning traces

Lib:
├── api-client.ts                     # Fetch client with auth
├── websocket-client.ts               # WebSocket wrapper
├── types.ts                          # Shared types with backend
└── utils.ts                          # Utility functions (format, calc, etc.)

Styles:
└── globals.css                       # TailwindCSS + custom styles
```

---

### Frontend Development Phases

**Phase 1: Core Dashboard (Week 1-2)**
- [ ] Next.js project setup + TypeScript
- [ ] Layout (Header, Sidebar, Main area)
- [ ] Dashboard page (static metrics first, then real-time)
- [ ] API endpoints for dashboard data
- [ ] WebSocket setup (listen to executed_trades)
- [ ] Trades table + sorting

**Phase 2: Live Signals & Details (Week 2-3)**
- [ ] Signals stream page (real-time WebSocket)
- [ ] Expandable reasoning traces
- [ ] Trade details modal with full LLM reasoning
- [ ] Charts (P&L over time, portfolio allocation)
- [ ] Mode switcher

**Phase 3: Polish & Monitoring (Week 3-4)**
- [ ] Positions page
- [ ] Settings page (mode, config)
- [ ] Agent monitoring + logs
- [ ] Reasoning debugger page
- [ ] Dark mode toggle
- [ ] Mobile responsiveness
- [ ] Error handling + toast alerts

**Phase 4: Advanced Features (Phase 2)**
- [ ] Export trades as CSV
- [ ] Email alerts for trades
- [ ] Custom dashboard layouts
- [ ] Performance comparison (mode vs mode)
- [ ] Backtesting UI integration

---

### Frontend Data Types (Shared with Backend)

```typescript
// Dashboard Summary
interface DashboardData {
  portfolio: {
    totalBalance: number;
    todayPnL: number;
    todayPnLPercent: number;
    allTimePnL: number;
    allTimePnLPercent: number;
    allocations: { ticker: string; value: number; percent: number }[];
  };
  metrics: {
    sharpeRatio: number;
    winRate: number;
    maxDrawdown: number;
    profitFactor: number;
    totalTrades: number;
  };
  agentStatus: { agent: string; status: "running" | "stopped" | "error"; lastHeartbeat: Date }[];
  recentTrades: Trade[];
}

// Trade (full details)
interface Trade {
  orderId: string;
  ticker: string;
  action: "BUY" | "SELL";
  entryPrice: number;
  exitPrice?: number;
  size: number;
  entryTime: Date;
  exitTime?: Date;
  pnl: number;
  pnlPercent: number;
  mode: "buffett" | "soros" | "cathie" | "contrarian";
  status: "open" | "closed";
  reasoning: {
    newsSignal: string;
    investmentAnalysis: string;
    personalityAdjustment: string;
    brokerExecution: string;
  };
}

// Signal
interface Signal {
  signalId: string;
  agent: "news" | "investment" | "personality";
  ticker: string;
  type: "sentiment" | "trade_recommendation" | "validation";
  sentiment?: number; // -1 to 1
  confidence: number; // 0 to 1
  action?: "BUY" | "SELL" | "HOLD";
  timestamp: Date;
  reasoning: string;
  llmTrace: {
    prompt: string;
    response: string;
    toolsCalled: string[];
  };
}

// Position
interface Position {
  ticker: string;
  entryPrice: number;
  currentPrice: number;
  size: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  entryTime: Date;
  daysHeld: number;
  mode: string;
  stopLoss?: number;
  takeProfit?: number;
}
```

---

### WebSocket Event Format

```typescript
// Frontend subscribes to WebSocket and receives:

// 1. New executed trade
{
  type: "trade_executed",
  data: { orderId, ticker, action, entryPrice, size, timestamp, mode }
}

// 2. Position P&L update (every 2-5 sec)
{
  type: "position_update",
  data: { ticker, currentPrice, unrealizedPnL, unrealizedPnLPercent, timestamp }
}

// 3. New signal processed
{
  type: "signal_received",
  data: { signalId, ticker, agent, sentiment, confidence, action, timestamp }
}

// 4. Metrics update
{
  type: "metrics_update",
  data: { todayPnL, todayPnLPercent, portfolioMetrics: {...}, timestamp }
}

// 5. Agent status change
{
  type: "agent_status",
  data: { agent, status, lastHeartbeat, error? }
}
```

---

## 🧠 LLM Reasoning Visibility

One key feature of this MVP: **trace LLM reasoning for every decision**. Each agent logs:
- Input data (signals, context)
- LLM system prompt used
- LLM response (reasoning, analysis)
- Final decision made
- Confidence and adjustments

This is logged to SQLite and displayed in Streamlit for debugging and validation.

---

## 📈 Future Phases

### Phase 2: Hybrid Reasoning & Tool Improvement
- [ ] Add more sophisticated LLM tools (e.g., sector comparison, insider buying analysis)
- [ ] Implement dynamic persona weighting (blend modes based on market regime)
- [ ] Add RL-based feedback: learn from trade outcomes, improve prompts

### Phase 3: Multi-Asset & Advanced Reasoning
- [ ] Expand to US large-cap stocks
- [ ] Add options (covered calls, protective puts)
- [ ] Multi-model reasoning (ensemble of Claude + GPT-4 for better accuracy)

### Phase 4: Production Hardening
- [ ] Distributed deployment (Kubernetes)
- [ ] Real-time monitoring & alerting
- [ ] LLM fine-tuning on historical trading data
- [ ] Advanced risk management (correlation hedging, dynamic position sizing)

### Phase 5: Autonomous Learning
- [ ] Store all trades + LLM reasoning in vector DB
- [ ] Continuous prompt optimization based on performance
- [ ] Learn when to switch personas automatically based on market regime

---

## ⚖️ Regulatory & Compliance Notes

**MVP (Paper Trading):**
- ✅ No registration required.
- ✅ Can run on personal account.
- ✅ Backtest & paper trade freely.
- ℹ️ LLM reasoning is fully traceable and explainable (good for compliance).

**If Going Live (Real Money):**
- ⚠️ Consult lawyer — may need SEC registration if managing others' money.
- ✅ LLM-based systems have **explainability advantage** — every trade has reasoning logged.
- ⚠️ Maintain audit logs of all LLM reasoning.
- ⚠️ Consider liability insurance if scaling to fund.

---

## 📝 Key Design Principles

1. **LLM-First Reasoning:** Agents use LLM to reason through decisions, not hard-coded rules.
2. **Explainability:** Every trade decision includes full LLM reasoning trace.
3. **Tool-Based:** LLM agents use structured tools (sentiment, quant, portfolio checks) for accurate, verifiable outputs.
4. **Modular Agents:** Each agent is independent LangGraph state graph; can be tested/debugged in isolation.
5. **Stateless Reasoning:** LLM prompts are deterministic; state lives in Kafka, Redis, SQLite.
6. **Observable:** Full reasoning traces logged for every decision (debugging + compliance).

---

## 🔍 Debugging LLM Reasoning

To understand how the LLM agents are reasoning:

1. **Check Reasoning Traces:** Streamlit dashboard displays full LLM reasoning for each trade
2. **SQLite Logs:** `trades.db` stores decision_reasoning column with full traces
3. **Pino Logs:** Structured JSON logs include LLM prompts, responses, and confidence
4. **Replay Mode:** Backtest can replay past signals and show what LLM would decide today vs. then

---

## 🤝 Contributing & Testing

- **Unit Tests:** Test individual agents with mock LLM responses
- **Integration Tests:** Test full Kafka pipeline with real LLM (Claude/GPT)
- **Backtests:** Always backtest new agent logic before live deployment
- **Reasoning Review:** Manually review LLM reasoning traces for quality

---

## 📞 Support & Questions

For architecture questions on LLM reasoning loops, agent design, or tool integration, refer to this README. Implementation details in code docstrings.

---

**Last Updated:** October 29, 2025
**Status:** MVP Architecture (LLM-Powered Agents with LangGraph) — Ready for Development Phase 1
**Language:** TypeScript + Node.js
**Agent Framework:** LangGraph (not rule-based)
