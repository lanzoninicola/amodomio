# Menu item interest

This folder centralizes how we track interest signals for cardapio items.

## Signals
- view_list: item appeared on screen (impression)
- open_detail: user expands/opens item details
- like: user liked the item
- share: user shared the item

## Suggested weights
- view_list = 1
- open_detail = 4
- like = 6
- share = 9

## Ranking
- Primary: score_7d (trend)
- Secondary: score_30d (stability)
- Tie-breaker: most recent event

Suggested formula:
score = (view_list * 1) + (open_detail * 4) + (like * 6) + (share * 9)

## Deduplication
- view_list: 1 per item per client every 6h
- open_detail: 1 per item per client every 3h
- like/share: 1 per item per client per day

## How each event helps
- view_list: denominator for rate-based ranking (interest per exposure)
- open_detail: strongest interest on the vitrines
- like: preference signal
- share: intent + advocacy signal
