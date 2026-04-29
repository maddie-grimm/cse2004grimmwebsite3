const API_BASE = "https://api.jolpi.ca/ergast/f1";

const fallbackRaces = [
  { round: "8", raceName: "Monaco Grand Prix", date: "2024-05-26", Circuit: { circuitName: "Circuit de Monaco", Location: { locality: "Monte Carlo", country: "Monaco" } } },
  { round: "12", raceName: "British Grand Prix", date: "2024-07-07", Circuit: { circuitName: "Silverstone Circuit", Location: { locality: "Silverstone", country: "United Kingdom" } } },
  { round: "16", raceName: "Italian Grand Prix", date: "2024-09-01", Circuit: { circuitName: "Autodromo Nazionale di Monza", Location: { locality: "Monza", country: "Italy" } } }
];

const fallbackDrivers = [
  { Driver: { givenName: "Charles", familyName: "Leclerc" }, Constructors: [{ name: "Ferrari" }] },
  { Driver: { givenName: "Max", familyName: "Verstappen" }, Constructors: [{ name: "Red Bull" }] },
  { Driver: { givenName: "Lando", familyName: "Norris" }, Constructors: [{ name: "McLaren" }] },
  { Driver: { givenName: "Lewis", familyName: "Hamilton" }, Constructors: [{ name: "Mercedes" }] }
];

let loadedRaces = fallbackRaces;
let loadedDrivers = fallbackDrivers;
let currentChart = "Position";
let lastSimData = null;

document.addEventListener("DOMContentLoaded", () => {
  setupMobileNav();
  setupRaceSelectors();
  setupStrategyBuilder();
  setupTabs();
  hydrateSimulatorFromStorage();
});

function setupMobileNav() {
  const button = document.querySelector(".menu-btn");
  const links = document.querySelector(".nav-links");
  if (!button || !links) return;
  button.addEventListener("click", () => links.classList.toggle("open"));
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

function driverName(item) {
  if (typeof item === "string") return item;
  return `${item.Driver.givenName} ${item.Driver.familyName}`;
}

function constructorName(item) {
  return item.Constructors?.[0]?.name || "F1 Team";
}

function raceLocation(race) {
  return `${race.Circuit?.Location?.locality || "Unknown"}, ${race.Circuit?.Location?.country || "Unknown"}`;
}

function setApiStatus(text, good = true) {
  document.querySelectorAll("#apiStatus").forEach(el => {
    el.textContent = text;
    el.style.color = good ? "#257a45" : "#8a5a00";
  });
}

async function loadApiData(season = "current") {
  try {
    const [racePayload, driverPayload] = await Promise.all([
      fetchJson(`${API_BASE}/${season}.json`),
      fetchJson(`${API_BASE}/${season}/driverStandings.json`)
    ]);

    loadedRaces = racePayload?.MRData?.RaceTable?.Races || fallbackRaces;
    loadedDrivers = driverPayload?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings || fallbackDrivers;

    if (!loadedRaces.length) loadedRaces = fallbackRaces;
    if (!loadedDrivers.length) loadedDrivers = fallbackDrivers;

    setApiStatus(`Live API connected: ${loadedRaces.length} races and ${loadedDrivers.length} drivers loaded.`);
  } catch (error) {
    loadedRaces = fallbackRaces;
    loadedDrivers = fallbackDrivers;
    setApiStatus("API fallback active: sample race data is being used.", false);
  }
}

async function setupRaceSelectors() {
  const seasonSelect = document.querySelector("#seasonSelect");
  const raceSelect = document.querySelector("#raceSelect");
  const driverSelect = document.querySelector("#driverSelect");
  if (!seasonSelect || !raceSelect || !driverSelect) return;

  async function refreshForSeason() {
    raceSelect.innerHTML = `<option>Loading races...</option>`;
    driverSelect.innerHTML = `<option>Loading drivers...</option>`;
    await loadApiData(seasonSelect.value);
    fillRaces();
    fillDrivers();
    updateRacePreview();
  }

  function fillRaces() {
    raceSelect.innerHTML = loadedRaces.map(race => `<option value="${race.round}">${race.raceName}</option>`).join("");
  }

  function fillDrivers() {
    driverSelect.innerHTML = loadedDrivers.map(d => `<option value="${driverName(d)}">${driverName(d)} · ${constructorName(d)}</option>`).join("");
  }

  function getCurrentRace() {
    return loadedRaces.find(race => race.round === raceSelect.value) || loadedRaces[0];
  }

  function updateRacePreview() {
    const race = getCurrentRace();
    if (!race) return;
    const selectedDriver = driverSelect.value || driverName(loadedDrivers[0]);

    setText("#raceName", race.raceName);
    setText("#raceRound", `Round ${race.round || "--"}`);
    setText("#raceLocation", raceLocation(race));
    setText("#raceDate", race.date || "TBD");
    setText("#raceTrack", race.Circuit?.circuitName || "Circuit TBD");
    setText("#raceDriver", selectedDriver);

    const cards = document.querySelector("#driverCards");
    if (cards) {
      cards.innerHTML = loadedDrivers.slice(0, 6).map(d => {
        const name = driverName(d);
        return `<div class="driver-card ${name === selectedDriver ? "selected" : ""}"><strong>${name}</strong><p>${constructorName(d)}</p></div>`;
      }).join("");
    }

    localStorage.setItem("f1Setup", JSON.stringify({
      raceName: race.raceName,
      round: race.round,
      date: race.date,
      circuit: race.Circuit?.circuitName,
      location: raceLocation(race),
      driver: selectedDriver,
      team: constructorName(loadedDrivers.find(d => driverName(d) === selectedDriver) || loadedDrivers[0])
    }));
  }

  seasonSelect.addEventListener("change", refreshForSeason);
  raceSelect.addEventListener("change", updateRacePreview);
  driverSelect.addEventListener("change", updateRacePreview);
  const save = document.querySelector("#saveSetup");
  if (save) save.addEventListener("click", updateRacePreview);

  await refreshForSeason();
}

function setupStrategyBuilder() {
  const list = document.querySelector("#stintList");
  if (!list) return;

  const addBtn = document.querySelector("#addStint");
  const aggression = document.querySelector("#aggression");
  const aggressionValue = document.querySelector("#aggressionValue");
  const simulate = document.querySelector("#simulateBtn");

  function createStint(laps = "1-18", tire = "Soft") {
    const div = document.createElement("div");
    div.className = "stint";
    div.innerHTML = `
      <div class="form-row">
        <label>Lap Range</label>
        <input type="text" value="${laps}" aria-label="Lap range">
      </div>
      <div class="form-row">
        <label>Tire</label>
        <select aria-label="Tire compound">
          <option ${tire === "Soft" ? "selected" : ""}>Soft</option>
          <option ${tire === "Medium" ? "selected" : ""}>Medium</option>
          <option ${tire === "Hard" ? "selected" : ""}>Hard</option>
        </select>
      </div>
      <div>
        <span class="tire-pill ${tireClass(tire)}">${tire}</span>
        <button class="icon-btn remove-stint" title="Remove stint" type="button">×</button>
      </div>
    `;

    const select = div.querySelector("select");
    const pill = div.querySelector(".tire-pill");
    select.addEventListener("change", () => {
      pill.textContent = select.value;
      pill.className = `tire-pill ${tireClass(select.value)}`;
      updateSummary();
    });
    div.querySelector("input").addEventListener("input", updateSummary);
    div.querySelector(".remove-stint").addEventListener("click", () => { div.remove(); updateSummary(); });
    list.appendChild(div);
    updateSummary();
  }

  if (addBtn) addBtn.addEventListener("click", () => createStint("", "Medium"));
  if (aggression && aggressionValue) {
    aggression.addEventListener("input", () => {
      aggressionValue.textContent = `${aggression.value}%`;
      updateSummary();
    });
  }
  if (simulate) {
    simulate.addEventListener("click", () => {
      const data = calculateSimulation();
      lastSimData = data;
      updateResultCards(data);
      drawChart(currentChart, data);
      setText("#simulationMessage", data.message);
    });
  }

  createStint("1-18", "Soft");
  createStint("19-47", "Medium");
  createStint("48-78", "Hard");
}

function getStintData() {
  return [...document.querySelectorAll(".stint")].map(stint => ({
    laps: stint.querySelector("input").value,
    tire: stint.querySelector("select").value
  }));
}

function parseRange(range, fallbackIndex) {
  const match = String(range).match(/(\d+)\s*-\s*(\d+)/);
  if (!match) return { start: fallbackIndex * 15 + 1, end: fallbackIndex * 15 + 15, length: 15 };
  const start = Number(match[1]);
  const end = Number(match[2]);
  return { start, end, length: Math.max(end - start + 1, 1) };
}

function calculateSimulation() {
  const stints = getStintData();
  const aggression = Number(document.querySelector("#aggression")?.value || 60);
  const pitStops = Math.max(stints.length - 1, 0);
  const tireScore = { Soft: 0.4, Medium: 0.22, Hard: 0.12 };
  const paceScore = { Soft: -0.8, Medium: -0.35, Hard: 0.05 };

  let lapTimes = [];
  let tireWear = [];
  let lap = 1;
  stints.forEach((stint, index) => {
    const range = parseRange(stint.laps, index);
    for (let i = 0; i < range.length; i++) {
      const deg = i * tireScore[stint.tire] * (1 + aggression / 160);
      const pace = 83 + paceScore[stint.tire] - aggression / 100 + deg;
      lapTimes.push(Number(pace.toFixed(2)));
      tireWear.push(Math.min(100, Math.round(i * tireScore[stint.tire] * 7)));
      lap++;
    }
  });

  const totalSeconds = lapTimes.reduce((sum, val) => sum + val, 0) + pitStops * 22.4;
  const efficiency = Math.max(4.8, 9.4 - Math.abs(pitStops - 2) * 1.1 - Math.abs(aggression - 62) / 30);
  const finish = efficiency > 8.3 ? "P2" : efficiency > 7.3 ? "P3" : efficiency > 6.4 ? "P4" : "P6";
  const message = `Simulation complete: ${pitStops} pit stop${pitStops === 1 ? "" : "s"}, ${stints.length} stint${stints.length === 1 ? "" : "s"}, and a projected ${finish} finish.`;

  return { stints, pitStops, lapTimes, tireWear, totalSeconds, efficiency, finish, message };
}

function updateSummary() {
  const data = calculateSimulation();
  updateResultCards(data);
  updateTimeline(data.stints);
}

function updateResultCards(data) {
  setText("#pitStops", data.pitStops);
  setText("#strategyRating", `${data.efficiency.toFixed(1)}/10`);
  setText("#projectedFinish", data.finish);
  setText("#raceTime", formatRaceTime(data.totalSeconds));
}

function updateTimeline(stints) {
  const timeline = document.querySelector("#strategyTimeline");
  if (!timeline) return;
  timeline.innerHTML = stints.map((stint, index) => {
    const range = parseRange(stint.laps, index);
    const width = Math.max(14, range.length * 1.35);
    return `<div class="timeline-segment timeline-${stint.tire.toLowerCase()}" style="flex:${width}">${stint.tire}</div>`;
  }).join("");
}

function setupTabs() {
  const tabs = document.querySelectorAll(".tab");
  if (!tabs.length) return;
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      currentChart = tab.textContent;
      setText("#chartTitle", `${currentChart} Chart`);
      drawChart(currentChart, lastSimData || calculateSimulation());
    });
  });
}

function drawChart(type, data) {
  const line = document.querySelector("#chartLine");
  if (!line) return;
  if (type === "Lap Times") {
    line.setAttribute("d", buildPath(data.lapTimes, false));
    line.setAttribute("stroke", "#555");
  } else if (type === "Tire Wear") {
    line.setAttribute("d", buildPath(data.tireWear, false));
    line.setAttribute("stroke", "#e5b400");
  } else {
    const position = data.lapTimes.map((time, index) => 190 - index * 1.35 + (time - 83) * 7);
    line.setAttribute("d", buildPath(position, true));
    line.setAttribute("stroke", "#c90000");
  }
}

function buildPath(values, rawY = false) {
  if (!values.length) return "M35 175 C115 150 160 112 230 130 S360 185 435 122 S560 80 655 68";
  const max = Math.max(...values);
  const min = Math.min(...values);
  const points = values.slice(0, 80).map((val, i, arr) => {
    const x = 35 + (i / Math.max(arr.length - 1, 1)) * 620;
    const normalized = rawY ? val : 220 - ((val - min) / Math.max(max - min, 1)) * 160;
    const y = Math.max(40, Math.min(220, normalized));
    return [x, y];
  });
  let d = `M${points[0][0].toFixed(0)} ${points[0][1].toFixed(0)}`;
  for (let i = 1; i < points.length; i += 8) {
    d += ` L${points[i][0].toFixed(0)} ${points[i][1].toFixed(0)}`;
  }
  return d;
}

async function hydrateSimulatorFromStorage() {
  if (!document.querySelector(".simulator-page")) return;

  const saved = JSON.parse(localStorage.getItem("f1Setup") || "null");
  if (saved) {
    setText("#simRaceTitle", saved.raceName || "Selected Grand Prix");
    setText("#simRaceMeta", `${saved.driver || "Selected Driver"} · ${saved.team || "F1 Team"} · ${saved.date || "Race date TBD"}`);
    setText("#simCircuitName", saved.circuit || "Selected Circuit");
    setText("#simCircuitLocation", saved.location || "Location TBD");
  }

  await loadApiData("current");
  drawChart("Position", calculateSimulation());
}

function tireClass(tire) {
  return tire === "Soft" ? "tire-soft" : tire === "Medium" ? "tire-medium" : "tire-hard";
}

function setText(selector, text) {
  const el = document.querySelector(selector);
  if (el) el.textContent = text;
}

function formatRaceTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
