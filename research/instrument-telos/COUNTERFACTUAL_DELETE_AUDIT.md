# Counterfactual delete test

For each costing action: if Decision Lab did not need this information for its own measurement,
would we still ask the player to do it?

`NO` is not automatically a defect. Every `NO` must name the payoff, when it arrives, how certain
it is, whether the player can see the contract, and what happens if it never arrives.

| Action | Answer | Reasoning |
|---|---|---|
| Place a move | **YES, NATURAL ACTIVITY** | It is chess. The instrument is reading something the player came to do |
| Submit the commitment | **YES** | It is what makes the reveal possible and what makes the reveal honest. A player who wanted the engine's verdict without recording first could get that from any engine, and would lose the only thing this product has |
| Type a username | **YES** | Paying nothing to see a reading of games already played is a normal thing people want |
| Wait for the import analysis | **YES** | The wait buys the finding directly |
| Read the reveal | **YES** | It is the payoff, not a cost |
| Continue after a reveal | **YES, NATURAL ACTIVITY** | The next position in a game being played |
| Play a blitz game | **YES, NATURAL ACTIVITY** | |
| Write the goal note | **YES** | Nothing reads it. It exists for the player and says so |
| State a confidence | **NO** | See below, C-1 |
| Name the read and the unknown | **NO, BUT THE OPTION VALUE IS IMMEDIATE** | See C-2 |
| Answer the counterfactual probe | **NO** | See C-3 |
| Finish a blitz game rather than abandon | **NO** | See C-4 |
| Answer a bank position | **NO** | See C-5 |
| Keep going to 60 | **NO** | See C-6 |

## C-1 Confidence

* **Payoff:** the calibration gap, which is the product's one differentiated claim. No engine can
  produce it, because it requires a number the player stated before any evaluation existed.
* **When:** at 60 scored decisions, 30 inside a bucket and 30 outside.
* **Certainty:** conditional, and the product says so out loud: *"ואפילו אז זו תהיה השערה, לא
  ממצא."*
* **Contract visible:** partly. The record dashboard says the question is sampled: *"שאלת הביטחון
  נשאלת תמיד בסט המשותף ובתרגול, ובחלק מההחלטות במשחק חופשי."* It does not say `ASK_RATE = 0.15`,
  and the shortfall line beside it counts in units of scored decisions.
* **If the payoff never arrives:** the player has stated a number on roughly one decision in seven
  and received nothing for it. Nothing is taken from them and nothing is given.

**This is the one cost in the product that is pure instrument and structurally irreplaceable.**
That is what a covered tax looks like: heavy, honest, and load-bearing.

## C-2 The reads

* **Payoff:** immediate, on the next screen. `nextQuestion` in `shared/reveal.ts` anchors the
  reveal's question to the player's own sentence: *"סימנת X. האם הקו של המנוע עונה על זה, או שהוא
  פשוט לא נכנס לשם?"* The file calls that text *"the one thing on screen the engine did not
  produce."*
* **When:** seconds later, every time.
* **Certainty:** certain.
* **Contract visible:** **no.** The player is asked for two sentences with no statement that they
  will come back as the question they are about to be asked.
* **If it never arrives:** it always arrives.

A repository comment elsewhere still says *"nothing downstream reads either one."* That sentence
described an earlier state, and the shipped build contradicts it at `Home.tsx:968` feeding
`statedUnknown` into the reveal. **This is a falsifier for H1 on one of the three rows H1 most
wants**, found by reading the code that consumes the field rather than the comment that describes
it.

## C-3 The counterfactual probe

* **Payoff, immediate:** the named alternative is scored beside the played move in the analysis
  column. It is real and it is **behind the `פרטי הניתוח` disclosure**, so the player pays where
  the payoff is not.
* **Payoff, full:** the four-way reading, `reachable` / `narrow` / `both-good` / `neither`, at
  `MIN_BUCKET_N = 30` probed decisions. At `PROBE_PROBABILITY = 0.35` that is roughly 86 decisions.
* **Certainty:** conditional on reaching 30.
* **Contract visible:** no, in either form.
* **If it never arrives:** the player answered an interrupting question about one decision in three
  and never learned that the answer was scored at all.

`shared/counterfactual.ts` marks the rate as *"A JUDGEMENT, NOT A MEASUREMENT"* and says plainly
that nothing has measured what rate a player tolerates. That is the repository declaring an
unvalidated tradeoff rather than an optimisation, which is the honest disposition and also the
weakest link in the burden chain.

## C-4 Finishing a blitz game

* **Payoff:** the post-game reading, and the game entering the blitz lane at all.
* **When:** at the end of the game.
* **Certainty:** certain if finished, **zero if abandoned**. A blitz game in progress writes
  nothing: measured, the record held only `decision-lab.progress` and the time control after twelve
  moves.
* **Contract visible:** **no.** Nothing tells the player that leaving mid-game discards everything
  they just did.
* **If it never arrives:** the player played a game inside a measurement product and produced no
  measurement, without being told that was possible.

## C-5 Bank positions

* **Payoff:** a between-player comparison, the only reading in the product that is not about the
  player alone.
* **When:** when enough players have answered the same positions.
* **Certainty:** depends on a population that does not exist yet.
* **Contract visible:** partly. The front door says *"אותן עמדות שכולם עונים עליהן"*, which names
  the mechanism without promising the reading.
* **If it never arrives:** the player answered fixed positions and got the same per-decision reveal
  they would have got anywhere else, which is not nothing.

## C-6 Accumulating to 60

* **Payoff:** the first claim.
* **When:** measured, 26 taps bought 1 of 60. The conversion is governed by `ASK_RATE`, so the
  honest order of magnitude is several hundred decisions.
* **Certainty:** conditional, and the product says the result may be *"אין דפוס"*, which is a
  legitimate outcome and a real payoff of a kind.
* **Contract visible:** the floor yes, in two places and in plain words. **The conversion rate no.**
  A player reading *"חסרות עוד 59"* has no way to learn that 59 counted decisions is not 59
  decisions.
* **If it never arrives:** the player played chess and read a true reveal after every decision,
  which is the base case the core loop already pays for.

## What the delete test changes about the hypothesis

Six `NO` rows, not sixteen. Four of the six name a payoff that exists. Two of the six,
**C-3's immediate half and C-4**, name a payoff that exists and is not where the cost is paid, or
does not exist at all if the player stops early.

The `NO` that matters most is **C-6**, and its defect is not the cost or the payoff. It is the
**unit**: the product counts in scored decisions and the player pays in decisions, and nothing on
the screen converts between them.
