from app.ieum.store import JsonStore

workspace = JsonStore("sources", "workspace")
sources = JsonStore("sources", "sources")
wizard_modes = JsonStore("sources", "wizard_modes")
ban_words = JsonStore("sources", "ban_words")
gov_apis = JsonStore("sources", "gov_apis")
discovery = JsonStore("sources", "discovery")


def list_sources():
    return sources.load()


def get_source(source_id):
    return next((s for s in list_sources() if s["id"] == source_id), None)


def upsert_source(src):
    rows = list_sources()
    for i, s in enumerate(rows):
        if s["id"] == src["id"]:
            rows[i] = {**s, **src}
            break
    else:
        rows.append(src)
    sources.save(rows)
    return next(s for s in rows if s["id"] == src["id"])


def delete_source(source_id):
    sources.save([s for s in list_sources() if s["id"] != source_id])
