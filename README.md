# Magic-The-Dungeon-Gathering

A board game with screens to help: a dungeon crawler played with Magic cards, with friends. Each player keeps their character sheet, the **Player Card**, open on their phone, while a shared tablet or TV shows the **Game**: the current room and its monsters. The devices don't talk to each other; players track their own state, like a board game.

This is an unofficial fan project, not affiliated with Wizards of the Coast.

The design, the rules and the code structure are in [DESIGN.md](DESIGN.md).

## Development

There is no build step and there are no dependencies. You do need a local server, because JavaScript modules don't load when the file is opened directly:

```
npm start        # python3 -m http.server 8000
```

Then open `http://localhost:8000`.

```
npm test         # node --test
```

## Card rules

What each card gives the player is decided card by card, in `js/rules/`:

- `keywords.js`: what each keyword does in this game (the text of its tooltip).
- `cards.js`: what each card's rules text gives when it is absorbed.
- `terms.js`: phrases in card text that mean something particular in this game, with their tooltip.

## Card pool

Rebuilding the test card pool takes Scryfall's "Oracle Cards" file from [Scryfall bulk data](https://scryfall.com/docs/api/bulk-data), which is not in the repo:

```
node scripts/build-pool.js level1.txt oracle-cards-YYYYMMDD.jsonl data/level1.json
```
