"""Text that came from students or course files goes inside <tags> in the
prompt. Swapping its angle brackets for look-alike quotation marks means it
cannot close the tag and pose as instructions."""

_DATA = str.maketrans(
    {
        "<": "\N{SINGLE LEFT-POINTING ANGLE QUOTATION MARK}",
        ">": "\N{SINGLE RIGHT-POINTING ANGLE QUOTATION MARK}",
    }
)


def as_data(text: str) -> str:
    return text.translate(_DATA)
