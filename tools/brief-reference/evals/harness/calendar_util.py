"""Project calendar math (5-day + holidays from project.json). Same semantics as the fixture's reference helpers."""
import datetime as dt
D = dt.date
class Calendar:
    def __init__(self, holidays):
        self.h = {D.fromisoformat(x) for x in holidays}
    def is_wd(self, d): return d.weekday() < 5 and d not in self.h
    def add_wd(self, d, n):
        step = 1 if n >= 0 else -1; k = 0
        while k != n:
            d += dt.timedelta(days=step)
            if self.is_wd(d): k += step
        return d
    def wd_between(self, a, b):
        n, d = 0, a
        while d < b:
            d += dt.timedelta(days=1)
            if self.is_wd(d): n += 1
        return n
def d_(s): return D.fromisoformat(s[:10]) if s else None
