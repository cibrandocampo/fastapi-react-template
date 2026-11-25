"""Input types shared by request bodies and parameters.

PostgreSQL text cannot hold the NUL character: every user-supplied string goes through these
types so a NUL is a 422 at the boundary instead of a database error.
"""

from typing import Annotated

from fastapi import Path
from pydantic import StringConstraints

NO_NUL = r"^[^\x00]*$"
# Names are shown to other users: no control characters, zero-width characters or bidirectional
# controls, which could make a name look like something else.
PLAIN_TEXT = r"^[^\x00-\x1f\x7f\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]*$"
MAX_DB_INT = 2_147_483_647  # INTEGER primary keys

Name = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=100, pattern=PLAIN_TEXT),
]
OptionalName = Annotated[
    str, StringConstraints(strip_whitespace=True, max_length=100, pattern=PLAIN_TEXT)
]
Secret = Annotated[str, StringConstraints(max_length=1024, pattern=NO_NUL)]
Code = Annotated[str, StringConstraints(max_length=12, pattern=NO_NUL)]
IdPath = Annotated[int, Path(ge=1, le=MAX_DB_INT)]
