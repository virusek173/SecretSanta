# Writing `participants.json`

Brief for whoever (human or agent) turns people's profiles into the participants file.
The result goes to `config/participants.json`, which is git-ignored. It holds personal
data: keep it out of commits, PRs and chat logs.

## Syntax

```json
{
  "participants": [
    {
      "name": "Ola",
      "email": "ola@example.com",
      "description": "Kobieta, 34 lata. Uwielbia jogę i bieganie…"
    }
  ]
}
```

UTF-8 JSON, one object with a `participants` array. Every entry has exactly these three
string fields, all non-empty:

| Field | Rules |
|---|---|
| `name` | Unique in the list (the app rejects duplicates). It is shown as-is to the person who draws this participant and used in the greeting `Cześć <name>!`, so use the form the group calls them by: `Ola`, `Wujek Marek`. Add a surname or nickname only to tell two people apart. |
| `email` | A valid address the person reads. Unique in the list: the app doesn't check this, and a shared address would let one person see two draws. |
| `description` | Polish prose, 300–700 characters. Feeds both the message and the image (see below). |

At least 3 participants. Validate before handing over, offline and free (after `npm run build`):

```bash
OPENAI_BASE_URL=http://127.0.0.1:9 OPENAI_API_KEY=x node dist/index.js --dry-run --no-images --participants <file>
```

It checks the JSON, the fields and duplicate names, prints the spoiler-free draw report, then
stops with a connection error at the first OpenAI call. That error is expected. Any error
before the report points at the file. Duplicate emails are not checked: compare them by eye.

## What goes into `description`

The text model reads it to write a warm message to the **giver** and suggest a gift; the
image model draws a Christmas scene from the same text. Write what helps a giver choose a
present, in this order:

1. **Gender and age**: `Kobieta, 61 lat.` / `Mężczyzna, 30 lat.` The message is in Polish,
   so this keeps grammatical forms right when the name doesn't reveal gender.
2. **Interests and hobbies, concretely**: `czyta kryminały skandynawskie`, not `lubi czytać`.
   Concrete nouns give the image model something to draw.
3. **Style and taste**: minimalist, loves gadgets, prefers experiences over things.
4. **Gift hints**: what they'd enjoy (`docenia dobrą kawę i akcesoria do parzenia`) and what
   to avoid (`ma już wszystkie narzędzia`, `nie lubi dekoracji`).

Keep out:

- **Anything the person wouldn't want their giver to read.** The giver may see it quoted in
  the email. Leave out health conditions, finances, family conflicts.
- **The person's relations to other participants** (`siostra Oli`, `mąż Marka`). The message
  might repeat them, and they add nothing to choosing a gift.
- **Names of other participants.** A giver reading another participant's name in their email
  may assume a link to the draw.
- **Contact details, addresses, phone numbers.** Only `email` carries contact data.

## Example

```json
{
  "name": "Ola",
  "email": "ola@example.com",
  "description": "Kobieta, 34 lata. Aktywna i kreatywna: praktykuje jogę, biega półmaratony, nagrywa i montuje krótkie filmy z podróży. Interesuje się finansami osobistymi i inwestowaniem. Lubi dobrze zaprojektowane, praktyczne rzeczy wysokiej jakości. Ucieszy się z akcesoriów do biegania, gadżetów do kamery albo dobrej książki o inwestowaniu. Nie przepada za ozdobami i bibelotami."
}
```
