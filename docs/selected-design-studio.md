# Selected design: Studio (F)

The user delegated the final choice after preferring A and B. Studio retains an early product view and generous comparison space, with fewer nested boxes. It is now applied to the actual local landing and checker, not just the fictional demo.

Changes: compact split introduction, broad landing comparison with a left decision note, quieter shared light/dark palette, left search/filter rail in desktop results, stacked filters on mobile. Existing matching, decisions, audit and export requirements are unchanged.

Verification: 97 unit tests, build and lint passed. Eight existing end-to-end tests passed, including mobile selected-row export and audit behavior. Visual review at 1280px desktop and 390px German dark-mode results; no document overflow on either checked page. Local preview: http://127.0.0.1:4175/ . No deployment in this turn.

Other concepts are retained only in design-demos as historical explorations; Studio is the default demo.

## Release validation

Studio approved for production. Added explicit light/dark selection to the standalone F demo with saved appearance preference. Added three browser tests covering EN/TR/DE language and theme persistence across landing, privacy, limitations and the checker. All three preference tests passed; the eight existing end-to-end tests passed. Unit tests: 97 passed; build and lint passed. Browser verified F demo dark surface and German controls. Deployment result is reported in the task.
