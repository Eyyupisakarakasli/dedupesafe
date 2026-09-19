# Benchmark

Run `npm run benchmark` to regenerate `latest.json` on the current machine.

The script builds deterministic contact rows with a known truth set. Five percent
of rows are duplicates that differ by an email `+tag`. It performs one warm-up,
then records one run for 10,000 rows and one for 50,000 rows. Results describe
that machine and dataset only. They are not a browser-wide performance promise.
