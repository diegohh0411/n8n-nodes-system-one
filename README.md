# n8n-nodes-system-one

An n8n community node for **System One** decision models: [TypeSafe's Jev](https://docs.typesafe.ai/concepts/system-one) and [Cloudflare's Clef](https://developers.cloudflare.com/workers-ai/models/clef/).

System One models take a **state** (text or JSON) and a set of typed **questions**, and return typed answers with calibrated probabilities instead of generated text. Use them for routing, classification, guardrails and other decision points in a workflow.

[Installation](#installation) · [Providers](#providers) · [Credentials](#credentials) · [Usage](#usage) · [Output](#output) · [Development](#development)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) and install `n8n-nodes-system-one`.

## Providers

| Provider | Endpoint | Models |
| - | - | - |
| OpenRouter | `POST https://openrouter.ai/api/v1/systemone` | `~typesafe/jev-latest`, `typesafe/jev-1.13` |
| TypeSafe | `POST https://api.typesafe.ai/v1/systemone` | `jev-latest`, `jev-preview`, `jev-1.13.0` |
| Cloudflare Workers AI | `POST https://api.cloudflare.com/client/v4/accounts/{id}/ai/run/@cf/cloudflare/clef` | `clef`, `clef-flash` |
| Custom endpoint | any URL that accepts the System One request body | any |

To send a model ID that isn't in the list, switch the Model field to an expression.

## Credentials

Each provider has its own credential type:

- **OpenRouter (System One) API**: an [OpenRouter API key](https://openrouter.ai/settings/keys). You don't need a TypeSafe account.
- **TypeSafe API**: a TypeSafe API key. The base URL defaults to `https://api.typesafe.ai`.
- **Cloudflare Workers AI (System One) API**: your account ID and an API token with Workers AI permissions.
- **System One Custom Endpoint API**: the full endpoint URL, plus a header name and key, which are sent as given, e.g. `Authorization: Bearer …`.

## Usage

1. **Credential, provider and model.** Choosing a credential also chooses the provider: n8n offers every System One credential in one dropdown, and when you create a new one, the provider picker sits in the credential dialog. The Model list then matches that provider. The canvas subtitle shows which provider is in use.
2. **State.** Choose what the model evaluates:
   - *Whole Input Item*: the incoming item's JSON (the default).
   - *Define Fields*: build an object field by field. Expressions that return objects stay structured.
   - *Text* or *JSON*.

   Structured state works best. Give fields clear names and refer to them in questions with backticks, e.g. ``Is `ticket` urgent?``.
3. **Questions.** Add as many as you need. They're all evaluated in parallel against the same state, so extra questions are cheap.
   - **Noul (yes/no)**: returns the probability of yes. You can optionally describe what *yes* and *no* mean.
   - **Choice**: picks one option from 2–255 options, each with an optional description.
   - **Score**: rates against 2–10 ordered levels, lowest first, starting at level 0.

   Instructions, options and levels each have a JSON mode for [structured questions](https://docs.typesafe.ai/primitives/advanced). If you'd rather compute the whole questions map with an expression, switch *Define Questions* to *Using JSON*.
4. **Route by Confidence** (optional). Turning this on adds a second output, **Uncertain**. An item goes there when any choice or score confidence falls below the threshold, or when a noul's certainty `|p − 0.5| × 2` does. The IDs of the uncertain answers are listed in `_uncertain`. This implements the [confidence-gated routing](https://docs.typesafe.ai/patterns/confidence-routing) pattern, e.g. sending uncertain items to human review.

### Options

| Option | Description |
| - | - |
| Put Output in Field | Field the result is written to (default `decision`). Leave it empty to merge the result into the top level. |
| Include Input Fields | Keep the input item's fields in the output (default on). |
| Noul Yes Threshold | The probability at or above which `<id>_yes` becomes `true` in simplified output. |
| Image Binary Fields | Cloudflare only. Up to 4 PNG, JPEG or WebP binary fields, sent as `images`. |
| Extra Body Fields | JSON merged into the request body, e.g. OpenRouter `provider` preferences. |
| Include Request | Add the request body that was sent to the output as `_request`, for debugging. |
| Timeout | Request timeout in milliseconds. |

The node is also usable as an AI Agent tool.

## Output

**Simplified** (default) is flat and convenient for IF and Switch nodes:

```json
{
  "decision": {
    "is_urgent": 0.95, "is_urgent_yes": true,
    "team": "billing", "team_confidence": 0.81, "team_probabilities": { "billing": 0.88, "technical": 0.12 },
    "frustration": 1.05, "frustration_level": "Frustrated", "frustration_confidence": 0.92, "frustration_probabilities": { "0": 0, "1": 0.95, "2": 0.05 }
  }
}
```

**Answers** returns `{ answers, model, usage }` exactly as the API types them. **Raw Response** returns the full response body.

## Compatibility

Built with `@n8n/node-cli` and tested on n8n 2.x. The package has no runtime dependencies.

## Development

```bash
npm install
npm run dev     # starts n8n at http://localhost:5678 with this node loaded
npm test        # builds, then runs unit tests
npm run lint
```

## Resources

- [TypeSafe System One docs](https://docs.typesafe.ai/concepts/system-one) and the [API reference](https://docs.typesafe.ai/api)
- [Jev on OpenRouter](https://openrouter.ai/docs/guides/community/jev)
- [Cloudflare Clef](https://developers.cloudflare.com/workers-ai/models/clef/)
- [n8n community nodes](https://docs.n8n.io/integrations/#community-nodes)
