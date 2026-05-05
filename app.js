const API_BASE = "https://api.jolpi.ca/ergast/f1";
const OPENF1_BASE = "https://api.openf1.org/v1";
const DEFAULT_TOTAL_LAPS = 78;
let activeTotalLaps = DEFAULT_TOTAL_LAPS;
let activeWeatherProfile = { condition: "dry", temp: "moderate", rainInches: 0, tempHigh: null, tempLow: null, summary: "" };

const fallbackRaces = [
  { round: "7", raceName: "Monaco Grand Prix", date: "2024-05-26", Circuit: { circuitName: "Circuit de Monaco", Location: { locality: "Monte Carlo", country: "Monaco" } } },
  { round: "12", raceName: "British Grand Prix", date: "2024-07-07", Circuit: { circuitName: "Silverstone Circuit", Location: { locality: "Silverstone", country: "United Kingdom" } } },
  { round: "16", raceName: "Italian Grand Prix", date: "2024-09-01", Circuit: { circuitName: "Autodromo Nazionale di Monza", Location: { locality: "Monza", country: "Italy" } } }
];

const fallbackDrivers = [
  { Driver: { driverId: "leclerc", givenName: "Charles", familyName: "Leclerc" }, Constructors: [{ name: "Ferrari" }] },
  { Driver: { driverId: "max_verstappen", givenName: "Max", familyName: "Verstappen" }, Constructors: [{ name: "Red Bull" }] },
  { Driver: { driverId: "norris", givenName: "Lando", familyName: "Norris" }, Constructors: [{ name: "McLaren" }] },
  { Driver: { driverId: "hamilton", givenName: "Lewis", familyName: "Hamilton" }, Constructors: [{ name: "Mercedes" }] }
];

let loadedRaces = fallbackRaces;
let loadedDrivers = fallbackDrivers;
let currentSeason = "2025";

document.addEventListener("DOMContentLoaded", () => {
  setupMobileNav();
  setupRaceSelectors();
  setupStrategyBuilder();
  hydrateSimulatorFromStorage();
  setupComparePage();
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
  if (!item) return "Selected Driver";
  if (typeof item === "string") return item;
  return `${item.Driver.givenName} ${item.Driver.familyName}`;
}

function driverId(item) {
  return item?.Driver?.driverId || "";
}

function constructorName(item) {
  return item?.Constructors?.[0]?.name || "F1 Team";
}

function driverNumber(item) {
  const num = item?.Driver?.permanentNumber || item?.Driver?.code;
  return num ? String(num) : "";
}

function normalizeName(value = "") {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function driverLastName(value = "") {
  const parts = String(value).trim().split(/\s+/);
  return parts[parts.length - 1] || value;
}

function raceLocation(race) {
  return `${race?.Circuit?.Location?.locality || "Unknown"}, ${race?.Circuit?.Location?.country || "Unknown"}`;
}

function setApiStatus(text, good = true) {
  document.querySelectorAll("#apiStatus").forEach(el => {
    el.textContent = text;
    el.style.color = good ? "#257a45" : "#8a5a00";
  });
}

async function loadApiData(season = "2025") {
  currentSeason = season;
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
    driverSelect.innerHTML = loadedDrivers.map(d => `<option value="${driverId(d)}">${driverName(d)} · ${constructorName(d)}</option>`).join("");
  }

  function getCurrentRace() {
    return loadedRaces.find(race => String(race.round) === String(raceSelect.value)) || loadedRaces[0];
  }

  function getCurrentDriver() {
    return loadedDrivers.find(d => driverId(d) === driverSelect.value) || loadedDrivers[0];
  }

  function updateRacePreview() {
    const race = getCurrentRace();
    const driver = getCurrentDriver();
    if (!race || !driver) return;

    setText("#raceName", race.raceName);
    setText("#raceRound", `Round ${race.round || "--"}`);
    setText("#raceLocation", raceLocation(race));
    setText("#raceDate", race.date || "TBD");
    setText("#raceTrack", race.Circuit?.circuitName || "Circuit TBD");
    setText("#raceDriver", driverName(driver));

    localStorage.setItem("f1Setup", JSON.stringify({
      season: seasonSelect.value,
      raceName: race.raceName,
      round: race.round,
      date: race.date,
      circuit: race.Circuit?.circuitName,
      location: raceLocation(race),
      lat: race.Circuit?.Location?.lat || race.Circuit?.Location?.latitude || "",
      long: race.Circuit?.Location?.long || race.Circuit?.Location?.longitude || "",
      driver: driverName(driver),
      driverId: driverId(driver),
      driverNumber: driverNumber(driver),
      team: constructorName(driver)
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

  function createStint(start = 1, end = 18, tire = "Soft", skipNormalize = false) {
    const div = document.createElement("div");
    div.className = "stint";
    div.innerHTML = `
      <div class="lap-range-fields">
        <div class="form-row">
          <label>Start Lap</label>
          <input class="lap-start" type="number" min="1" value="${start}" aria-label="Start lap" readonly>
        </div>
        <div class="form-row">
          <label>End Lap</label>
          <input class="lap-end" type="number" min="1" value="${end}" aria-label="End lap">
        </div>
      </div>
      <div class="form-row">
        <label>Tire</label>
        <select aria-label="Tire compound">
          <option ${tire === "Soft" ? "selected" : ""}>Soft</option>
          <option ${tire === "Medium" ? "selected" : ""}>Medium</option>
          <option ${tire === "Hard" ? "selected" : ""}>Hard</option>
          <option ${tire === "Intermediate" ? "selected" : ""}>Intermediate</option>
          <option ${tire === "Wet" ? "selected" : ""}>Wet</option>
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
      updateStrategyPreview();
    });
    div.querySelector(".lap-end").addEventListener("input", () => normalizeStints(div));
    div.querySelector(".lap-end").addEventListener("change", () => normalizeStints(div));
    div.querySelector(".remove-stint").addEventListener("click", () => {
      div.remove();
      rebalanceStints();
    });
    list.appendChild(div);
    if (!skipNormalize) normalizeStints(div);
  }

  if (addBtn) addBtn.addEventListener("click", () => {
    const count = document.querySelectorAll(".stint").length;
    if (count >= activeTotalLaps) {
      setText("#simulationMessage", `This race only has ${activeTotalLaps} laps, so you cannot add more than ${activeTotalLaps} one-lap stints.`);
      return;
    }
    createStint(1, 1, "Medium", true);
    rebalanceStints();
  });

  if (aggression && aggressionValue) {
    aggression.addEventListener("input", () => {
      aggressionValue.textContent = `${aggression.value}%`;
    });
  }

  if (simulate) {
    simulate.addEventListener("click", () => {
      normalizeStints();
      const data = calculateSimulation();
      updateResultCards(data);
      setText("#simulationMessage", data.message);
      localStorage.setItem("f1UserSimulation", JSON.stringify({
        ...data,
        totalLaps: activeTotalLaps,
        savedAt: new Date().toISOString()
      }));
    });
  }

  createStint(1, 18, "Soft", true);
  createStint(19, 47, "Medium", true);
  createStint(48, activeTotalLaps, "Hard", true);
  rebalanceStints();
}

function setTotalLaps(total) {
  activeTotalLaps = Math.max(1, Number(total) || DEFAULT_TOTAL_LAPS);
  const lapText = document.querySelector("#simRaceMeta");
  if (lapText && !lapText.textContent.includes(`${activeTotalLaps} laps`)) {
    lapText.textContent = lapText.textContent.replace(/\d+\s*lap model/i, `${activeTotalLaps} lap model`);
  }
  rebalanceStints();
}

async function fetchRaceLapCount(season, round) {
  try {
    const resultPayload = await fetchJson(`${API_BASE}/${season}/${round}/results.json`);
    const race = resultPayload?.MRData?.RaceTable?.Races?.[0];
    const winnerLaps = Number(race?.Results?.[0]?.laps);
    return winnerLaps || DEFAULT_TOTAL_LAPS;
  } catch (error) {
    return DEFAULT_TOTAL_LAPS;
  }
}

function rebalanceStints() {
  const nodes = [...document.querySelectorAll(".stint")];
  if (!nodes.length) return;
  const count = nodes.length;
  const base = Math.floor(activeTotalLaps / count);
  let extra = activeTotalLaps % count;
  let start = 1;

  nodes.forEach((node) => {
    const length = Math.max(1, base + (extra > 0 ? 1 : 0));
    if (extra > 0) extra -= 1;
    const end = Math.min(activeTotalLaps, start + length - 1);
    node.querySelector(".lap-start").value = start;
    node.querySelector(".lap-end").value = end;
    start = end + 1;
  });

  updateStrategyPreview();
}

function normalizeStints(changedStint) {
  const nodes = [...document.querySelectorAll(".stint")];
  if (!nodes.length) return;

  const changedIndex = changedStint ? nodes.indexOf(changedStint) : -1;
  if (changedIndex === -1) {
    rebalanceStints();
    return;
  }

  let start = 1;
  nodes.forEach((node, index) => {
    const startInput = node.querySelector(".lap-start");
    const endInput = node.querySelector(".lap-end");
    startInput.value = start;

    const remainingStints = nodes.length - index - 1;
    const maxEnd = activeTotalLaps - remainingStints;
    let end = Number(endInput.value) || start;

    if (index < changedIndex) {
      end = Math.max(start, Math.min(Number(endInput.value) || start, maxEnd));
    } else if (index === changedIndex) {
      end = Math.max(start, Math.min(end, maxEnd));
    } else {
      const remainingIncludingThis = nodes.length - index;
      const remainingLaps = activeTotalLaps - start + 1;
      const suggested = start + Math.max(1, Math.floor(remainingLaps / remainingIncludingThis)) - 1;
      end = index === nodes.length - 1 ? activeTotalLaps : Math.min(suggested, activeTotalLaps - remainingStints);
    }

    endInput.value = end;
    start = end + 1;
  });

  updateStrategyPreview();
}

function getStintData() {
  return [...document.querySelectorAll(".stint")].map((stint, index) => {
    const start = Number(stint.querySelector(".lap-start")?.value) || index + 1;
    const end = Math.max(start, Number(stint.querySelector(".lap-end")?.value) || start);
    return {
      start,
      end,
      laps: `${start}-${end}`,
      length: Math.max(end - start + 1, 1),
      tire: stint.querySelector("select")?.value || "Medium"
    };
  });
}


function classifyWeatherFromValues({ rainInches = 0, high = null, low = null, summary = "", rainText = "" } = {}) {
  const combined = `${summary} ${rainText}`.toLowerCase();
  let condition = "dry";
  if (Number(rainInches) >= 0.16 || combined.includes("wet")) condition = "wet";
  else if (Number(rainInches) >= 0.03 || combined.includes("mixed") || combined.includes("possible") || combined.includes("variable")) condition = "mixed";

  let temp = "moderate";
  const numericHigh = Number(high);
  if (Number.isFinite(numericHigh)) {
    if (numericHigh >= 86) temp = "hot";
    else if (numericHigh <= 60) temp = "cool";
  } else if (combined.includes("hot") || combined.includes("warm")) {
    temp = "hot";
  } else if (combined.includes("cool")) {
    temp = "cool";
  }

  activeWeatherProfile = { condition, temp, rainInches: Number(rainInches) || 0, tempHigh: high, tempLow: low, summary };
  return activeWeatherProfile;
}

function tireWeatherAdjustment(tire, weather) {
  const compound = String(tire || "Medium").toLowerCase();
  const condition = weather?.condition || "dry";
  const temp = weather?.temp || "moderate";

  let pacePenalty = 0;
  let wearMultiplier = 1;
  let fitBonus = 0;

  if (condition === "wet") {
    if (compound === "wet") { pacePenalty -= 1.0; wearMultiplier *= 0.82; fitBonus += 1.0; }
    else if (compound === "intermediate") { pacePenalty -= 0.25; wearMultiplier *= 0.95; fitBonus += 0.55; }
    else { pacePenalty += 2.6; wearMultiplier *= 1.45; fitBonus -= 1.0; }
  } else if (condition === "mixed") {
    if (compound === "intermediate") { pacePenalty -= 0.75; wearMultiplier *= 0.88; fitBonus += 0.9; }
    else if (compound === "wet") { pacePenalty += 0.55; wearMultiplier *= 1.12; fitBonus += 0.1; }
    else { pacePenalty += 0.7; wearMultiplier *= 1.18; fitBonus -= 0.25; }
  } else {
    if (compound === "intermediate") { pacePenalty += 1.5; wearMultiplier *= 1.35; fitBonus -= 0.85; }
    else if (compound === "wet") { pacePenalty += 2.25; wearMultiplier *= 1.65; fitBonus -= 1.15; }
    else if (compound === "soft") { fitBonus += 0.2; }
  }

  if (temp === "hot" && ["soft", "medium"].includes(compound)) {
    wearMultiplier *= compound === "soft" ? 1.28 : 1.14;
    pacePenalty += compound === "soft" ? 0.25 : 0.1;
  }
  if (temp === "cool" && compound === "hard") {
    pacePenalty += 0.25;
    wearMultiplier *= 1.08;
  }

  return { pacePenalty, wearMultiplier, fitBonus };
}

function weatherStrategyNote(weather) {
  if (!weather) return "";
  if (weather.condition === "wet") return " Wet conditions heavily favor full wet or intermediate tires and punish dry compounds.";
  if (weather.condition === "mixed") return " Mixed conditions make intermediate tires more valuable and add risk to dry-compound stints.";
  if (weather.temp === "hot") return " Hot track conditions increase tire degradation, especially on softer compounds.";
  if (weather.temp === "cool") return " Cooler conditions make tire warmup more important, especially on hard compounds.";
  return " Weather was treated as mostly neutral for this run.";
}

function calculateSimulation() {
  const stints = getStintData().filter(stint => stint.length >= 1);
  const aggression = Number(document.querySelector("#aggression")?.value || 60);
  const weather = activeWeatherProfile || { condition: "dry", temp: "moderate" };
  // A pit stop happens between two tire stints. Three stints = two pit stops.
  const pitStops = Math.max(stints.length - 1, 0);
  const tireScore = { Soft: 0.4, Medium: 0.22, Hard: 0.12, Intermediate: 0.28, Wet: 0.35 };
  const paceScore = { Soft: -0.8, Medium: -0.35, Hard: 0.05, Intermediate: 0.65, Wet: 1.25 };

  let lapTimes = [];
  let tireWear = [];
  let weatherFit = 0;
  stints.forEach((stint) => {
    const weatherAdjustment = tireWeatherAdjustment(stint.tire, weather);
    weatherFit += weatherAdjustment.fitBonus * stint.length;
    for (let i = 0; i < stint.length; i++) {
      const wearBase = (tireScore[stint.tire] || 0.25) * weatherAdjustment.wearMultiplier;
      const deg = i * wearBase * (1 + aggression / 160);
      const pace = 83 + (paceScore[stint.tire] || 0) + weatherAdjustment.pacePenalty - aggression / 100 + deg;
      lapTimes.push(Number(pace.toFixed(2)));
      tireWear.push(Math.min(100, Math.round(i * wearBase * 7)));
    }
  });

  const totalSeconds = lapTimes.reduce((sum, val) => sum + val, 0) + pitStops * 22.4;
  const averageWeatherFit = stints.length ? weatherFit / activeTotalLaps : 0;
  const efficiency = Math.max(3.8, Math.min(9.9, 9.2 - Math.abs(pitStops - 2) * 1.05 - Math.abs(aggression - 62) / 32 + averageWeatherFit));
  const finish = efficiency > 8.3 ? "P2" : efficiency > 7.3 ? "P3" : efficiency > 6.4 ? "P4" : "P6";
  const message = `Simulation complete over ${activeTotalLaps} laps: ${pitStops} pit stop${pitStops === 1 ? "" : "s"}, ${stints.length} stint${stints.length === 1 ? "" : "s"}, and a projected ${finish} finish.${weatherStrategyNote(weather)}`;

  return { stints, pitStops, lapTimes, tireWear, totalSeconds, efficiency, finish, message, aggression, totalLaps: activeTotalLaps, weather };
}

function updateStrategyPreview() {
  updateTimeline(getStintData());
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
  timeline.innerHTML = stints.map((stint) => {
    const width = Math.max(1, stint.length);
    return `<div class="timeline-segment timeline-${stint.tire.toLowerCase()}" style="flex:${width}">${stint.laps} · ${stint.tire}</div>`;
  }).join("");
}

async function hydrateSimulatorFromStorage() {
  if (!document.querySelector(".simulator-page")) return;

  const saved = JSON.parse(localStorage.getItem("f1Setup") || "null");
  if (saved) {
    setText("#simRaceTitle", saved.raceName || "Selected Grand Prix");
    setText("#simRaceMeta", `${saved.driver || "Selected Driver"} · ${saved.team || "F1 Team"} · ${saved.season || "Season"}`);
    setText("#simCircuitName", saved.circuit || "Selected Circuit");
    setText("#simCircuitLocation", saved.location || "Location TBD");
    await loadApiData(saved.season || "2024");
    const laps = await fetchRaceLapCount(saved.season || "2024", saved.round || "1");
    setTotalLaps(laps);
    setText("#simRaceMeta", `${saved.driver || "Selected Driver"} · ${saved.team || "F1 Team"} · ${laps} lap model`);
    await updateWeatherPanel(saved);
  } else {
    await loadApiData("2025");
    setTotalLaps(DEFAULT_TOTAL_LAPS);
    await updateWeatherPanel(null);
  }
}

async function updateWeatherPanel(setup) {
  if (!document.querySelector("#weatherPanel")) return;

  if (!setup || !setup.date) {
    setText("#weatherSummary", "Select a race on the Setup page to view weather conditions for race day.");
    setText("#weatherTemp", "---");
    setText("#weatherRain", "---");
    setText("#weatherWind", "---");
    activeWeatherProfile = { condition: "dry", temp: "moderate", rainInches: 0, tempHigh: null, tempLow: null, summary: "" };
    return;
  }

  setText("#weatherSummary", `Loading race-day weather for ${setup.raceName || "the selected race"}...`);
  setText("#weatherTemp", "Loading");
  setText("#weatherRain", "Loading");
  setText("#weatherWind", "Loading");

  try {
    const coords = await getWeatherCoordinates(setup);
    if (!coords) throw new Error("Missing circuit coordinates.");

    const date = setup.date;
    const payload = await fetchJson(`https://archive-api.open-meteo.com/v1/archive?latitude=${encodeURIComponent(coords.lat)}&longitude=${encodeURIComponent(coords.long)}&start_date=${encodeURIComponent(date)}&end_date=${encodeURIComponent(date)}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto`);
    const daily = payload?.daily || {};
    const high = daily.temperature_2m_max?.[0];
    const low = daily.temperature_2m_min?.[0];
    const rain = daily.precipitation_sum?.[0];
    const wind = daily.wind_speed_10m_max?.[0];

    const tempText = high != null && low != null ? `${Math.round(low)}–${Math.round(high)}°F` : "Unavailable";
    const rainText = rain != null ? `${Number(rain).toFixed(2)} in` : "Unavailable";
    const windText = wind != null ? `${Math.round(wind)} mph` : "Unavailable";
    const condition = rain > 0.05 ? "wet or mixed conditions likely" : "mostly dry conditions likely";
    classifyWeatherFromValues({ rainInches: Number(rain) || 0, high, low, summary: condition, rainText });

    setText("#weatherSummary", `${setup.raceName} in ${setup.location}: ${condition} on race day based on historical weather data.`);
    setText("#weatherTemp", tempText);
    setText("#weatherRain", rainText);
    setText("#weatherWind", windText);
  } catch (error) {
    const fallback = getFallbackWeather(setup);
    classifyWeatherFromValues({ summary: fallback.summary, rainText: fallback.rain });
    setText("#weatherSummary", fallback.summary);
    setText("#weatherTemp", fallback.temp);
    setText("#weatherRain", fallback.rain);
    setText("#weatherWind", fallback.wind);
  }
}

async function getWeatherCoordinates(setup) {
  const lat = Number(setup.lat);
  const long = Number(setup.long);
  if (Number.isFinite(lat) && Number.isFinite(long)) return { lat, long };

  const known = findKnownCircuitCoordinates(setup);
  if (known) return known;

  if (!setup.location) return null;
  const query = setup.location.split(",")[0].trim();
  const geo = await fetchJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`);
  const first = geo?.results?.[0];
  return first ? { lat: first.latitude, long: first.longitude } : null;
}

function findKnownCircuitCoordinates(setup) {
  const key = normalizeName(`${setup.circuit || ""} ${setup.raceName || ""} ${setup.location || ""}`);
  const circuits = [
    ["albertpark australiangrandprix melbourne", -37.8497, 144.968],
    ["shanghai chinesegp chinesegrandprix", 31.3389, 121.22],
    ["suzuka japanesegp japanesegrandprix", 34.8431, 136.541],
    ["bahrain bahraininternationalcircuit", 26.0325, 50.5106],
    ["jeddah saudia arabian saudiarabiangrandprix", 21.6319, 39.1044],
    ["miami miamigp miamigrandprix", 25.958, -80.2389],
    ["imola emiliaromagna", 44.3439, 11.7167],
    ["monaco montecarlo", 43.7347, 7.4206],
    ["catalunya spanishgrandprix barcelona", 41.57, 2.2611],
    ["gillesvilleneuve canadangrandprix montreal", 45.5017, -73.5228],
    ["redbullring austrian grandprix spielberg", 47.2197, 14.7647],
    ["silverstone britishgrandprix", 52.0786, -1.0169],
    ["spa belgian grandprix", 50.4372, 5.9714],
    ["hungaroring hungarian grandprix", 47.5822, 19.2511],
    ["zandvoort dutchgrandprix", 52.3888, 4.5409],
    ["monza italiangrandprix", 45.6156, 9.2811],
    ["baku azerbaijangrandprix", 40.3725, 49.8533],
    ["marinabay singaporegrandprix", 1.2914, 103.864],
    ["americas unitedstatesgrandprix austin", 30.1328, -97.6411],
    ["rodriguez mexicocitygrandprix mexico", 19.4042, -99.0907],
    ["interlagos saopaulograndprix brazil", -23.7036, -46.6997],
    ["lasvegas lasvegasgrandprix", 36.1147, -115.1728],
    ["losail qatargp qatargrandprix", 25.49, 51.4542],
    ["yasmarina abudhabigrandprix", 24.4672, 54.6031]
  ];
  const match = circuits.find(([name]) => name.split(/\s+/).some(part => key.includes(part)));
  return match ? { lat: match[1], long: match[2] } : null;
}

function getFallbackWeather(setup) {
  const loc = normalizeName(setup?.location || setup?.raceName || "");
  if (loc.includes("singapore") || loc.includes("miami") || loc.includes("qatar") || loc.includes("bahrain") || loc.includes("saudi")) {
    return { summary: "This race is usually hot, which increases tire degradation and makes overheating more important.", temp: "Warm", rain: "Variable", wind: "Moderate" };
  }
  if (loc.includes("silverstone") || loc.includes("belgium") || loc.includes("spa") || loc.includes("zandvoort")) {
    return { summary: "This circuit often has cooler, changeable weather, so strategy can be more sensitive to rain and tire warmup.", temp: "Cool", rain: "Possible", wind: "Variable" };
  }
  return { summary: "Weather estimate loaded for the selected race. Conditions should be considered when choosing stint length and tire aggression.", temp: "Moderate", rain: "Low", wind: "Moderate" };
}

async function setupComparePage() {
  if (!document.querySelector(".compare-page")) return;

  const setup = JSON.parse(localStorage.getItem("f1Setup") || "null");
  const sim = JSON.parse(localStorage.getItem("f1UserSimulation") || "null");

  renderUserPlan(sim);
  await renderRealPlan(setup, sim);
}

function renderUserPlan(sim) {
  const container = document.querySelector("#yourPlanTable");
  if (!container) return;

  if (!sim || !sim.stints) {
    container.innerHTML = `<div class="empty-state">No saved simulation yet. Build a tire plan on the Simulator page and click “Simulate Race.”</div>`;
    return;
  }

  setText("#yourPlanSummary", `${sim.stints.length} stints, ${sim.pitStops} pit stops, projected ${sim.finish}.`);
  setText("#compareYourFinish", sim.finish || "Not run");
  container.innerHTML = buildStrategyTable(sim.stints.map(stint => [stint.laps, stint.tire]));
}

async function renderRealPlan(setup, sim) {
  const summary = document.querySelector("#realPlanSummary");
  const container = document.querySelector("#realPlanTable");
  if (!summary || !container) return;

  if (!setup || !setup.season || !setup.round || !setup.driverId) {
    summary.textContent = "No setup information was found.";
    container.innerHTML = `<div class="empty-state">Select a season, race, and driver on the Setup page first.</div>`;
    setText("#compareRealFinish", "No setup");
    return;
  }

  try {
    const resultPayload = await fetchJson(`${API_BASE}/${setup.season}/${setup.round}/results.json`);
    const race = resultPayload?.MRData?.RaceTable?.Races?.[0];
    const result = race?.Results?.find(r => r.Driver?.driverId === setup.driverId);

    if (!result) throw new Error("Driver result not found for selected race.");

    const status = result.status || "Unknown";
    const classified = status === "Finished" || /^\+\d+\s+Lap/i.test(status);
    setText("#compareRealFinish", classified ? `P${result.position}` : "DNF");

    if (!classified) {
      summary.textContent = `${setup.driver} did not finish this race.`;
      container.innerHTML = `<div class="empty-state"><strong>DNF: Did Not Finish.</strong><br>${setup.driver} was classified with the race status “${status}.” Because the driver did not complete a normal race distance, the simulator cannot make a fair stint-by-stint comparison against the real result.</div>`;
      setText("#compareGain", "Not comparable");
      return;
    }

    const totalLaps = Number(race?.Results?.[0]?.laps || sim?.stints?.at(-1)?.end || DEFAULT_TOTAL_LAPS);
    let realStints = [];

    try {
      const openF1Stints = await fetchOpenF1Stints(setup);
      if (openF1Stints.length) {
        realStints = openF1Stints.map(stint => ({
          laps: `${stint.lap_start}-${stint.lap_end}`,
          tire: formatCompound(stint.compound),
          stintNumber: stint.stint_number
        }));
      }
    } catch (openError) {
    }

    if (!realStints.length) {
      const pitPayload = await fetchJson(`${API_BASE}/${setup.season}/${setup.round}/pitstops.json`);
      const pitRace = pitPayload?.MRData?.RaceTable?.Races?.[0];
      const pitStops = pitRace?.PitStops?.filter(p => p.driverId === setup.driverId) || [];
      realStints = buildRealStintsFromPitStops(pitStops, totalLaps);
    }

    const realPitStops = Math.max(realStints.length - 1, 0);
    summary.textContent = `${setup.driver}'s actual ${setup.season} ${setup.raceName} plan: ${realStints.length} stint${realStints.length === 1 ? "" : "s"}, ${realPitStops} pit stop${realPitStops === 1 ? "" : "s"}.`;
    container.innerHTML = buildStrategyTable(realStints.map(stint => [stint.laps, stint.tire]));

    if (sim?.finish) {
      const simPos = Number(String(sim.finish).replace("P", ""));
      const realPos = Number(result.position);
      const diff = realPos - simPos;
      setText("#compareGain", diff > 0 ? `+${diff} positions` : diff < 0 ? `${diff} positions` : "Same position");
    } else {
      setText("#compareGain", "Run simulation");
    }
  } catch (error) {
    summary.textContent = "Real race comparison could not be loaded from the API.";
    container.innerHTML = `<div class="empty-state">The app could not find complete result, pit-stop, or stint data for this exact season, race, and driver. Try another race from the Setup page.</div>`;
    setText("#compareRealFinish", "Unavailable");
    setText("#compareGain", "Pending");
  }
}

async function fetchOpenF1Stints(setup) {
  if (Number(setup.season) < 2023) return [];

  const meetings = await fetchJson(`${OPENF1_BASE}/meetings?year=${encodeURIComponent(setup.season)}`);
  const meeting = findMatchingOpenF1Meeting(meetings, setup);
  if (!meeting) return [];

  const sessions = await fetchJson(`${OPENF1_BASE}/sessions?meeting_key=${meeting.meeting_key}`);
  const raceSession = sessions.find(s => String(s.session_name).toLowerCase() === "race") || sessions.find(s => /race/i.test(s.session_name));
  if (!raceSession) return [];

  let number = setup.driverNumber;
  if (!number) {
    const drivers = await fetchJson(`${OPENF1_BASE}/drivers?session_key=${raceSession.session_key}`);
    const match = drivers.find(d => normalizeName(`${d.first_name || ""}${d.last_name || ""}`) === normalizeName(setup.driver))
      || drivers.find(d => normalizeName(d.last_name || "") === normalizeName(driverLastName(setup.driver)));
    number = match?.driver_number;
  }

  if (!number) return [];
  const stints = await fetchJson(`${OPENF1_BASE}/stints?session_key=${raceSession.session_key}&driver_number=${number}`);
  return [...stints].sort((a, b) => Number(a.lap_start) - Number(b.lap_start));
}

function findMatchingOpenF1Meeting(meetings, setup) {
  if (!Array.isArray(meetings)) return null;
  const raceName = normalizeName(setup.raceName || "");
  const circuit = normalizeName(setup.circuit || "");
  const location = normalizeName(setup.location || "");
  const setupDate = setup.date ? new Date(setup.date) : null;

  return meetings.find(m => normalizeName(m.meeting_name || "") === raceName)
    || meetings.find(m => raceName && normalizeName(m.meeting_name || "").includes(raceName.replace("grandprix", "")))
    || meetings.find(m => circuit && normalizeName(m.location || "").includes(circuit))
    || meetings.find(m => location && location.includes(normalizeName(m.country_name || "")))
    || meetings.find(m => {
      if (!setupDate || !m.date_start) return false;
      const diffDays = Math.abs(new Date(m.date_start) - setupDate) / 86400000;
      return diffDays <= 7;
    });
}

function formatCompound(compound = "Unknown") {
  const text = String(compound).toLowerCase().replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function buildRealStintsFromPitStops(pitStops, totalLaps) {
  const ordered = [...pitStops].sort((a, b) => Number(a.lap) - Number(b.lap));
  let start = 1;
  const stints = [];

  ordered.forEach((stop, index) => {
    const pitLap = Math.max(start, Number(stop.lap) || start);
    stints.push({ laps: `${start}-${pitLap}`, tire: `Unknown compound · pit on lap ${pitLap}` });
    start = pitLap + 1;
  });

  if (start <= totalLaps || !stints.length) {
    stints.push({ laps: `${start}-${totalLaps}`, tire: "Unknown compound" });
  }

  return stints;
}

function buildStrategyTable(rows) {
  return `<table><tr><th>Laps</th><th>Tire</th></tr>${rows.map(([laps, tire]) => `<tr><td>${laps}</td><td>${tire}</td></tr>`).join("")}</table>`;
}

function tireClass(tire) {
  if (tire === "Soft") return "tire-soft";
  if (tire === "Medium") return "tire-medium";
  if (tire === "Hard") return "tire-hard";
  if (tire === "Intermediate") return "tire-intermediate";
  if (tire === "Wet") return "tire-wet";
  return "tire-hard";
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
