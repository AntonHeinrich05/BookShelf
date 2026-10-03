"""Page results and counts in one aggregation; only page documents leave MongoDB."""
from database import db


async def book_page(base_query, query, sort, skip, limit, ownership=None, read=None):
    pipeline = [{"$match": base_query}, {"$facet": {
        "items": [{"$match": query}, {"$sort": dict(sort + [("id", 1)])}, {"$skip": skip}, {"$limit": limit}, {"$project": {"_id": 0}}],
        "summary": [{"$match": query}, {"$group": {"_id": None, "total": {"$sum": 1},
                    "finished": {"$sum": {"$cond": [{"$eq": ["$status", "finished"]}, 1, 0]}},
                    "pages": {"$sum": {"$cond": [{"$eq": ["$status", "finished"]}, {"$ifNull": ["$page_count", 0]}, 0]}}}}],
        "counts": [{"$group": {"_id": {"ownership": "$ownership", "status": "$status"}, "n": {"$sum": 1}}}],
    }}]
    result = (await db.books.aggregate(pipeline).to_list(1))[0]
    summary = result["summary"][0] if result["summary"] else {"total": 0, "finished": 0, "pages": 0}
    summary.pop("_id", None)
    total = summary.pop("total")
    counts = {"all": 0, "read": 0, "unread": 0, "ownership": {}}
    for group in result["counts"]:
        own, status, n = group["_id"].get("ownership"), group["_id"].get("status"), group["n"]
        counts["all"] += n
        finished = status == "finished"
        if not ownership or own == ownership:
            counts["read" if finished else "unread"] += n
        if not read or (read == "read") == finished:
            counts["ownership"][own] = counts["ownership"].get(own, 0) + n
    return {"items": result["items"], "total": total, "next_skip": skip + limit, "has_more": skip + limit < total,
            "summary": summary, "counts": counts}