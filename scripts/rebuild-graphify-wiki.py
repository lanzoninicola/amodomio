#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

from networkx.readwrite import json_graph

from graphify.analyze import god_nodes
from graphify.cluster import score_all
from graphify.watch import _rebuild_code
from graphify.wiki import to_wiki


def rebuild_wiki(root: Path) -> int:
    graph_path = root / "graphify-out" / "graph.json"
    if not graph_path.exists():
        raise FileNotFoundError(f"{graph_path} does not exist")

    data = json.loads(graph_path.read_text(encoding="utf-8"))
    edge_key = "edges" if "edges" in data else "links"
    graph = json_graph.node_link_graph(data, edges=edge_key)

    communities: dict[int, list[str]] = {}
    for node_id, attrs in graph.nodes(data=True):
        community_id = attrs.get("community")
        if community_id is None:
            continue
        communities.setdefault(int(community_id), []).append(node_id)

    communities = {cid: sorted(nodes) for cid, nodes in communities.items()}
    labels = {cid: f"Community {cid}" for cid in communities}

    return to_wiki(
        graph,
        communities,
        root / "graphify-out" / "wiki",
        community_labels=labels,
        cohesion=score_all(graph, communities),
        god_nodes_data=god_nodes(graph),
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Rebuild graphify code graph and regenerate graphify-out/wiki."
    )
    parser.add_argument("--root", default=".", help="Project root")
    parser.add_argument(
        "--skip-code-rebuild",
        action="store_true",
        help="Only regenerate wiki from existing graphify-out/graph.json",
    )
    args = parser.parse_args()

    root = Path(args.root).resolve()
    if not args.skip_code_rebuild:
        ok = _rebuild_code(root)
        if not ok:
            raise SystemExit(1)

    article_count = rebuild_wiki(root)
    print(
        f"[graphify wiki] Generated {article_count} articles + index at "
        f"{root / 'graphify-out' / 'wiki' / 'index.md'}"
    )


if __name__ == "__main__":
    main()
