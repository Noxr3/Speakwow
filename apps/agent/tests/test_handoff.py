from handoff import dead_ends, handoff_rate, hands_off


def test_turns_that_hand_off() -> None:
    for turn in (
        "A cat! I have a lazy dog, Bean. What's your cat's name?",
        "Noodles, yum! Beef noodles or tomato-egg noodles?",
        "Grade eight! Lots of homework, right?",
        "My favourite snack is chips. Your favourite snack is…",
        "One thing I like, then you. I like rainy days. Your turn: one thing you like.",
        "你为什么想学英语呀\uff1f",
    ):
        assert hands_off(turn), turn
        assert not dead_ends(turn), (turn, dead_ends(turn))


def test_turns_that_kill_the_conversation() -> None:
    assert dead_ends("Mimi is a cute name.") == ["D1"]
    assert dead_ends("Great job!") == ["D2"]
    assert "D4" in dead_ends("What's your cat's name? Mine is called Bean, he is lazy.")
    assert "D5" in dead_ends("Do you like cats? What pets do you have?")
    assert "D5" not in dead_ends("Do you like cats, right?")
    assert "D10" in dead_ends("So, what do you want to talk about?")
    assert not hands_off("I walked by the bay last night. The water was really quiet.")
    assert handoff_rate(["Nice!", "Cats or dogs?"]) == 0.5
    assert handoff_rate([]) is None
