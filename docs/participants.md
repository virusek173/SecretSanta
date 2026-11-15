# Writing `participants.json`

## What the file is for

`participants.json` is the only input of the Secret Santa app: the list of people taking
part in the gift exchange. The app reads it, draws who buys a gift for whom, and emails
each person the name of the one they drew. For every pair it uses the description of the
person who **receives** the gift: an AI writes a personal Christmas message with a gift
idea, and an AI image model draws a festive picture. Both go into the email to the person
who **gives** the gift.

So each entry answers two questions: where to send this person their draw (`name`, `email`),
and what their Secret Santa should know to pick them a good present (`description`).

This brief is for whoever (human or agent) turns people's profiles into that file.
The result goes to `config/participants.json`, which is git-ignored. It holds personal
data: keep it out of commits, PRs and chat logs.

## Syntax

```json
{
  "participants": [
    {
      "name": "Ola",
      "email": "ola@example.com",
      "description": "Kobieta, 34 lata. Uwielbia jogę i bieganie…",
      "gender": "female"
    }
  ]
}
```

UTF-8 JSON, one object with a `participants` array. Every entry has these string fields;
`name`, `email` and `description` are required and non-empty:

| Field | Rules |
|---|---|
| `name` | Unique in the list (the app rejects duplicates). It is shown as-is to the person who draws this participant and used in the greeting `Cześć <name>!`, so use the form the group calls them by: `Ola`, `Wujek Marek`. Add a surname or nickname only to tell two people apart. |
| `email` | A valid address the person reads. Unique in the list: the app doesn't check this, and a shared address would let one person see two draws. |
| `description` | Polish prose, 300–700 characters. Feeds both the message and the image (see below). |
| `gender` | `"female"` or `"male"`. Optional, but set it for everyone you can. The Polish message needs it for verb forms (*zostałeś* / *zostałaś*), and the AI never guesses gender from a name: without the field it writes around gendered forms, which reads stiffer. Leave it out only when unsure. |

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

1. **Age and life stage**: `Kobieta, 61 lat, emerytka.` / `Mężczyzna, 30 lat.` Gender for
   grammar comes from the `gender` field; repeating it here just helps the gift idea.
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
  "description": "Kobieta, 34 lata. Aktywna i kreatywna: praktykuje jogę, biega półmaratony, nagrywa i montuje krótkie filmy z podróży. Interesuje się finansami osobistymi i inwestowaniem. Lubi dobrze zaprojektowane, praktyczne rzeczy wysokiej jakości. Ucieszy się z akcesoriów do biegania, gadżetów do kamery albo dobrej książki o inwestowaniu. Nie przepada za ozdobami i bibelotami.",
  "gender": "female"
}
```
