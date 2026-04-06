exec:
	docker compose start
	docker compose exec app bash

diff:
	git diff --cached > .diff