"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { PlanStop } from "@/lib/planner";

// S02-③ 지도 — OSM + Leaflet (docs/PLAN.md). 서버가 준 좌표·순서를 찍기만 하고 계산하지 않는다.
export default function CourseMap({ stops }: { stops: PlanStop[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current, { scrollWheelZoom: false });

    const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    // 보이는 타일을 하나도 못 받았으면 지도 대신 안내를 보여 준다
    let loadedTiles = 0;
    tiles.on("tileload", () => loadedTiles++);
    tiles.on("load", () => loadedTiles === 0 && setFailed(true));

    const points = stops.map((s) => [s.lat, s.lon] as L.LatLngTuple);
    // 방문 순서를 잇는 직선 — 실제 길이 아니다
    L.polyline(points, { color: "#0969da", weight: 3, opacity: 0.7, dashArray: "6 6" }).addTo(map);

    stops.forEach((stop, i) => {
      const popup = document.createElement("div");
      popup.textContent = `${i + 1} · ${stop.name} · ${stop.arrive}~${stop.depart}`;
      L.marker([stop.lat, stop.lon], {
        icon: L.divIcon({ className: "map-marker", html: String(i + 1), iconSize: [28, 28], iconAnchor: [14, 14] }),
        title: `${i + 1} ${stop.name}`,
      })
        .bindPopup(popup)
        .addTo(map);
    });

    map.fitBounds(L.latLngBounds(points), { padding: [24, 24], maxZoom: 15 });

    return () => {
      map.remove();
    };
  }, [stops]);

  if (failed) return <div className="map-slot">지도를 불러오지 못했어요</div>;
  return <div ref={containerRef} className="course-map" role="region" aria-label="코스 지도" />;
}
