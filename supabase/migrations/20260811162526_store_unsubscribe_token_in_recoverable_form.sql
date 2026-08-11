-- Design correction: the unsubscribe token needs to appear, unchanged, in
-- every notification email sent to a subscriber over time — not just once
-- like the confirm token. A hash-only design (as originally written) means
-- the raw value is thrown away right after being minted, so it could never
-- actually be re-embedded in a later email; nobody would ever be able to use
-- it. Storing it in recoverable form is the correct tradeoff here: an
-- unsubscribe token being read from a DB dump only lets someone unsubscribe
-- an address (low severity, arguably user-protective), unlike the confirm
-- token (flips a subscription to active) which correctly stays hash-only.
-- It is still a high-entropy random value, unrelated to and never derived
-- from the subscriber's row id, satisfying "not guessable / does not leak
-- the database id".

alter table subscribers rename column unsubscribe_token_hash to unsubscribe_token;

drop index if exists subscribers_unsubscribe_token_hash_key;
create unique index if not exists subscribers_unsubscribe_token_key
  on subscribers (unsubscribe_token);
