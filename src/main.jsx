import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { MapContainer, Marker, Popup, ImageOverlay, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";

const STORAGE_KEY = "dnd-world-map-v1";

const bounds = [
  [0, 0],
  [1000, 1000],
];

const defaultData = {
  mode: "dm",
  locations: []
};

const icon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function AddMarker({ onAdd }) {
  useMapEvents({
    click(e) {
      const name = prompt("Название локации:");
      if (!name) return;

      onAdd({
        id: crypto.randomUUID(),
        name,
        type: "Город",
        description: "",
        dmNotes: "",
        visible: true,
        lat: e.latlng.lat,
        lng: e.latlng.lng,
      });
    },
  });

  return null;
}

function App() {
  const [data, setData] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultData;
    } catch {
      return defaultData;
    }
  });

  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const selected = useMemo(
    () => data.locations.find((l) => l.id === selectedId),
    [data.locations, selectedId]
  );

  function updateLocation(id, patch) {
    setData((prev) => ({
      ...prev,
      locations: prev.locations.map((l) =>
        l.id === id ? { ...l, ...patch } : l
      ),
    }));
  }

  function deleteLocation(id) {
    setData((prev) => ({
      ...prev,
      locations: prev.locations.filter((l) => l.id !== id),
    }));
    setSelectedId(null);
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dnd-map-export.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJson(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);

        if (!imported || !Array.isArray(imported.locations)) {
          alert("Неверный формат файла.");
          return;
        }

        setData({
          mode: imported.mode || "dm",
          locations: imported.locations,
        });

        setSelectedId(null);
        alert("Импорт завершён.");
      } catch {
        alert("Не удалось прочитать JSON.");
      } finally {
        event.target.value = "";
      }
    };

    reader.readAsText(file);
  }

  const visibleLocations =
    data.mode === "dm"
      ? data.locations
      : data.locations.filter((l) => l.visible);

  return (
    <div className="app">
      <header className="topbar">
        <strong>D&D World Map</strong>

        <div className="controls">
          <button onClick={() => setData((p) => ({ ...p, mode: p.mode === "dm" ? "player" : "dm" }))}>
            Режим: {data.mode === "dm" ? "Мастер" : "Игрок"}
          </button>

          <button onClick={exportJson}>Экспорт JSON</button>

          <label className="importButton">
            Импорт JSON
            <input type="file" accept="application/json" onChange={importJson} />
          </label>
        </div>
      </header>

      <main className="layout">
        <section className="mapWrap">
          <MapContainer
            crs={L.CRS.Simple}
            bounds={bounds}
            maxBounds={bounds}
            minZoom={-1}
            style={{ height: "100%", width: "100%" }}
          >
            <ImageOverlay url="/map.jpg" bounds={bounds} />
            <AddMarker
              onAdd={(location) =>
                setData((prev) => ({
                  ...prev,
                  locations: [...prev.locations, location],
                }))
              }
            />

            {visibleLocations.map((loc) => (
              <Marker
                key={loc.id}
                position={[loc.lat, loc.lng]}
                icon={icon}
                eventHandlers={{ click: () => setSelectedId(loc.id) }}
              >
                <Popup>{loc.name}</Popup>
              </Marker>
            ))}
          </MapContainer>
        </section>

        <aside className="sidebar">
          {!selected && (
            <div className="empty">
              <h2>Локация не выбрана</h2>
              <p>Кликни по карте, чтобы добавить пин. Кликни по пину, чтобы редактировать описание.</p>
            </div>
          )}

          {selected && (
            <div className="editor">
              <input
                value={selected.name}
                onChange={(e) => updateLocation(selected.id, { name: e.target.value })}
                className="titleInput"
              />

              <label>Тип</label>
              <input
                value={selected.type}
                onChange={(e) => updateLocation(selected.id, { type: e.target.value })}
              />

              <label>Описание для игроков</label>
              <textarea
                value={selected.description}
                onChange={(e) => updateLocation(selected.id, { description: e.target.value })}
              />

              {data.mode === "dm" && (
                <>
                  <label>Секретные заметки мастера</label>
                  <textarea
                    value={selected.dmNotes}
                    onChange={(e) => updateLocation(selected.id, { dmNotes: e.target.value })}
                  />

                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={selected.visible}
                      onChange={(e) => updateLocation(selected.id, { visible: e.target.checked })}
                    />
                    Видно игрокам
                  </label>

                  <button className="danger" onClick={() => deleteLocation(selected.id)}>
                    Удалить локацию
                  </button>
                </>
              )}
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
