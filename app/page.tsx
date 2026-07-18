"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

type SearchMode = "route" | "number" | "station";
type SortMode = "departure" | "duration" | "stops" | "number";

interface Metadata {
  database_date: string;
  database_version: number;
  trains_count: number;
  stops_count: number;
  stations_count: number;
  classes_count: number;
  trips_crossing_midnight: number;
}

interface Train {
  train_id: number;
  train_number: string;
  class_id: number;
  class_ar: string;
  class_en: string;
  stops_count: number;
  origin_ar: string;
  origin_en: string;
  destination_ar: string;
  destination_en: string;
  duration_minutes: number;
  duration_display: string;
  info: string;
}

interface Stop {
  train_id: number;
  train_number: string;
  stop_sequence: number;
  station_id: number;
  station_ar: string;
  station_en: string;
  arrival_time: string;
  departure_time: string;
  arrival_display: string;
  departure_display: string;
  arrival_absolute_minute: number;
  departure_absolute_minute: number;
  arrival_day_offset: number;
  departure_day_offset: number;
  note: string;
  travel_info: string;
}

interface TrainData {
  metadata: Metadata;
  trains: Train[];
  stops: Stop[];
}

interface Station {
  id: number;
  ar: string;
  en: string;
  norm: string;
}

interface Result {
  train: Train;
  from: Stop;
  to: Stop;
  fromIndex: number;
  toIndex: number;
  departure: number;
  arrival: number;
  duration: number;
  intermediate: number;
  boardStop?: Stop;
}

interface RecentSearch {
  fromId: number;
  from: string;
  toId: number;
  to: string;
  date: string;
}

const AR_DAYS = ["الاحد", "الاثنين", "الثلاثاء", "الاربعاء", "الخميس", "الجمعه", "السبت"];
const POPULAR_ROUTES = [
  ["القاهره", "الاسكندريه"],
  ["القاهره", "اسوان"],
  ["القاهره", "المنصوره"],
  ["الاسكندريه", "طنطا"],
  ["القاهره", "الزقازيق"],
  ["الجيزه", "الاقصر"],
];

const normalize = (value = "") =>
  String(value)
    .toLowerCase()
    .trim()
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[^\u0600-\u06ffa-z0-9]+/g, " ");

const todayValue = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};

const toClock = (absolute: number) => {
  const minute = ((Number(absolute) % 1440) + 1440) % 1440;
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
};

const durationText = (minutes: number) => {
  const safe = Math.max(0, Number(minutes) || 0);
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  return hours ? `${hours} س${rest ? ` ${rest} د` : ""}` : `${rest} د`;
};

const arNumber = (value: number | string) => new Intl.NumberFormat("ar-EG").format(Number(value));

const formatDate = (value: string) => {
  if (!value) return "";
  return new Intl.DateTimeFormat("ar-EG", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${value}T12:00:00`));
};

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    train: <><rect x="6" y="3" width="12" height="15" rx="3"/><path d="M8 21l2-3m6 0 2 3M6 9h12M9 13h.01M15 13h.01"/></>,
    pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    swap: <><path d="m7 7-4 4 4 4M3 11h14M17 3l4 4-4 4M21 7H7"/></>,
    moon: <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>,
    share: <><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    arrow: <path d="m15 18-6-6 6-6"/>,
    chevron: <path d="m9 18 6-6-6-6"/>,
    close: <path d="M18 6 6 18M6 6l12 12"/>,
    check: <path d="m20 6-11 11-5-5"/>,
    compare: <><path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3M12 2v20"/></>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
    wifi: <><path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 20h.01"/></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 9A7 7 0 0 1 18 6l2 6M18 15a7 7 0 0 1-12 3l-2-6"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name] ?? paths.info}
    </svg>
  );
}

function StationPicker({
  label,
  placeholder,
  stations,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  stations: Station[];
  value: Station | null;
  onChange: (station: Station | null) => void;
}) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const query = value?.ar ?? draft;
  const matches = useMemo(() => {
    const q = normalize(query);
    if (!q) return stations.slice(0, 10);
    return stations.filter((station) => station.norm.includes(q)).slice(0, 12);
  }, [query, stations]);

  const choose = (station: Station) => {
    setDraft(station.ar);
    onChange(station);
    setOpen(false);
  };

  return (
    <div className="field station-field">
      <label>{label}</label>
      <div className="field-control">
        <Icon name="pin" />
        <input
          value={query}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onChange={(event) => {
            setDraft(event.target.value);
            onChange(null);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((current) => Math.min(current + 1, matches.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((current) => Math.max(current - 1, 0));
            } else if (event.key === "Enter" && open && matches[active]) {
              event.preventDefault();
              choose(matches[active]);
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
        />
      </div>
      {open && (
        <div className="suggestions" id={listId} role="listbox">
          {matches.length ? matches.map((station, index) => (
            <button
              type="button"
              role="option"
              aria-selected={active === index}
              className={active === index ? "active" : ""}
              key={station.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(station)}
            >
              <span className="suggestion-icon"><Icon name="train" size={17} /></span>
              <span><strong>{station.ar}</strong><small>{station.en || "محطة قطار"}</small></span>
            </button>
          )) : <div className="no-suggestion">لا توجد محطة مطابقة</div>}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [data, setData] = useState<TrainData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [mode, setMode] = useState<SearchMode>("route");
  const [from, setFrom] = useState<Station | null>(null);
  const [to, setTo] = useState<Station | null>(null);
  const [boardStation, setBoardStation] = useState<Station | null>(null);
  const [trainNumber, setTrainNumber] = useState("");
  const [date, setDate] = useState(() => typeof window === "undefined" ? todayValue() : new URLSearchParams(window.location.search).get("date") ?? todayValue());
  const [period, setPeriod] = useState("");
  const [trainClass, setTrainClass] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [searched, setSearched] = useState(false);
  const [resultTitle, setResultTitle] = useState("الرحلات المتاحة");
  const [sort, setSort] = useState<SortMode>("departure");
  const [shown, setShown] = useState(12);
  const [detail, setDetail] = useState<Result | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareIds, setCompareIds] = useState<Set<number>>(new Set());
  const [favorites, setFavorites] = useState<Set<number>>(() => {
    if (typeof window === "undefined") return new Set();
    try { return new Set(JSON.parse(localStorage.getItem("sekka-favorites") ?? "[]")); }
    catch { return new Set(); }
  });
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [recent, setRecent] = useState<RecentSearch[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem("sekka-recent") ?? "[]"); }
    catch { return []; }
  });
  const [toast, setToast] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    const stored = localStorage.getItem("sekka-theme") as "light" | "dark" | null;
    return stored ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  });
  const [mobileMenu, setMobileMenu] = useState(false);
  const resultsRef = useRef<HTMLElement>(null);

  useEffect(() => {
    fetch("/data/train_data.json")
      .then((response) => {
        if (!response.ok) throw new Error("data");
        return response.json();
      })
      .then((payload: TrainData) => setData(payload))
      .catch(() => setLoadError(true));

    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("sekka-theme", theme);
  }, [theme]);

  useEffect(() => {
    document.body.classList.toggle("modal-open", Boolean(detail || compareOpen || mobileMenu));
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDetail(null);
        setCompareOpen(false);
        setMobileMenu(false);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [detail, compareOpen, mobileMenu]);

  const index = useMemo(() => {
    if (!data) return null;
    const stopsByTrain = new Map<number, Stop[]>();
    const stopsByStation = new Map<number, Stop[]>();
    const trainById = new Map(data.trains.map((train) => [Number(train.train_id), train]));
    const stationMap = new Map<number, Station>();
    for (const stop of data.stops) {
      const trainId = Number(stop.train_id);
      const stationId = Number(stop.station_id);
      if (!stopsByTrain.has(trainId)) stopsByTrain.set(trainId, []);
      if (!stopsByStation.has(stationId)) stopsByStation.set(stationId, []);
      stopsByTrain.get(trainId)!.push(stop);
      stopsByStation.get(stationId)!.push(stop);
      if (!stationMap.has(stationId)) {
        stationMap.set(stationId, {
          id: stationId,
          ar: stop.station_ar || `محطة ${stationId}`,
          en: stop.station_en || "",
          norm: normalize(`${stop.station_ar ?? ""} ${stop.station_en ?? ""}`),
        });
      }
    }
    for (const stops of stopsByTrain.values()) stops.sort((a, b) => a.stop_sequence - b.stop_sequence);
    const stations = [...stationMap.values()].sort((a, b) => a.ar.localeCompare(b.ar, "ar"));
    const classes = [...new Set(data.trains.map((train) => train.class_ar).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ar"));
    return { stopsByTrain, stopsByStation, trainById, stationMap, stations, classes };
  }, [data]);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };

  const runsOnSelectedDate = (train: Train, stops: Stop[]) => {
    if (!date) return true;
    const text = normalize(`${train.info ?? ""} ${stops[0]?.travel_info ?? ""}`);
    const listedDays = AR_DAYS.filter((day) => text.includes(day));
    if (!listedDays.length) return true;
    return listedDays.includes(AR_DAYS[new Date(`${date}T12:00:00`).getDay()]);
  };

  const timeMatches = (minute: number) => {
    if (!period) return true;
    const hour = Math.floor((((minute % 1440) + 1440) % 1440) / 60);
    if (period === "morning") return hour >= 4 && hour < 12;
    if (period === "afternoon") return hour >= 12 && hour < 17;
    if (period === "evening") return hour >= 17 && hour < 21;
    return hour >= 21 || hour < 4;
  };

  const makeResult = (train: Train, stops: Stop[], fromIndex: number, toIndex: number, boardStop?: Stop): Result => {
    const start = stops[fromIndex];
    const end = stops[toIndex];
    const departure = Number(start.departure_absolute_minute ?? start.arrival_absolute_minute ?? 0);
    const arrival = Number(end.arrival_absolute_minute ?? end.departure_absolute_minute ?? 0);
    return {
      train,
      from: start,
      to: end,
      fromIndex,
      toIndex,
      departure: boardStop ? Number(boardStop.departure_absolute_minute ?? boardStop.arrival_absolute_minute ?? 0) : departure,
      arrival,
      duration: Math.max(0, arrival - departure),
      intermediate: Math.max(0, toIndex - fromIndex - 1),
      boardStop,
    };
  };

  const completeSearch = (items: Result[], title: string) => {
    setResults(items);
    setResultTitle(title);
    setSearched(true);
    setShown(12);
    setCompareIds(new Set());
    window.setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };

  const searchRoute = (chosenFrom = from, chosenTo = to) => {
    if (!data || !index) return;
    if (!chosenFrom || !chosenTo) return notify("اختر محطتي القيام والوصول من القائمة");
    if (chosenFrom.id === chosenTo.id) return notify("محطة القيام والوصول لا يمكن أن تكون واحدة");
    const found: Result[] = [];
    for (const train of data.trains) {
      if (trainClass && train.class_ar !== trainClass) continue;
      const stops = index.stopsByTrain.get(Number(train.train_id)) ?? [];
      if (!runsOnSelectedDate(train, stops)) continue;
      const fromIndex = stops.findIndex((stop) => Number(stop.station_id) === chosenFrom.id);
      if (fromIndex < 0) continue;
      const toIndex = stops.findIndex((stop, position) => position > fromIndex && Number(stop.station_id) === chosenTo.id);
      if (toIndex < 0) continue;
      const item = makeResult(train, stops, fromIndex, toIndex);
      if (timeMatches(item.departure)) found.push(item);
    }
    const recentSearch: RecentSearch = { fromId: chosenFrom.id, from: chosenFrom.ar, toId: chosenTo.id, to: chosenTo.ar, date };
    const nextRecent = [recentSearch, ...recent.filter((item) => item.fromId !== chosenFrom.id || item.toId !== chosenTo.id)].slice(0, 4);
    setRecent(nextRecent);
    localStorage.setItem("sekka-recent", JSON.stringify(nextRecent));
    const params = new URLSearchParams({ from: String(chosenFrom.id), to: String(chosenTo.id), date });
    history.replaceState(null, "", `?${params.toString()}`);
    completeSearch(found, `${chosenFrom.ar} ← ${chosenTo.ar}`);
  };

  const searchByNumber = (all = false) => {
    if (!data || !index) return;
    const query = trainNumber.trim();
    if (!all && !query) return notify("اكتب رقم القطار أولًا");
    const found = data.trains
      .filter((train) => (all || String(train.train_number).includes(query)) && (!trainClass || train.class_ar === trainClass))
      .map((train) => {
        const stops = index.stopsByTrain.get(Number(train.train_id)) ?? [];
        return stops.length > 1 ? makeResult(train, stops, 0, stops.length - 1) : null;
      })
      .filter((item): item is Result => Boolean(item));
    completeSearch(found, all ? "دليل جميع القطارات" : `نتائج القطار رقم ${query}`);
  };

  const searchStation = () => {
    if (!index || !boardStation) return notify("اختر المحطة من القائمة");
    const found = (index.stopsByStation.get(boardStation.id) ?? [])
      .map((boardStop) => {
        const train = index.trainById.get(Number(boardStop.train_id));
        if (!train || (trainClass && train.class_ar !== trainClass)) return null;
        const stops = index.stopsByTrain.get(Number(train.train_id)) ?? [];
        if (!runsOnSelectedDate(train, stops)) return null;
        const boardIndex = stops.findIndex((stop) => stop === boardStop);
        if (boardIndex < 0 || !timeMatches(Number(boardStop.departure_absolute_minute ?? boardStop.arrival_absolute_minute ?? 0))) return null;
        return makeResult(train, stops, 0, stops.length - 1, boardStop);
      })
      .filter((item): item is Result => Boolean(item));
    completeSearch(found, `لوحة محطة ${boardStation.ar}`);
  };

  useEffect(() => {
    if (!index) return;
    const params = new URLSearchParams(location.search);
    const fromId = Number(params.get("from"));
    const toId = Number(params.get("to"));
    if (fromId && toId) {
      const source = index.stationMap.get(fromId) ?? null;
      const destination = index.stationMap.get(toId) ?? null;
      if (source && destination) {
        window.setTimeout(() => {
          setFrom(source);
          setTo(destination);
          searchRoute(source, destination);
        }, 0);
      }
    }
    // Run once after the local database is indexed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const sortedResults = useMemo(() => {
    const list = favoritesOnly ? results.filter((item) => favorites.has(Number(item.train.train_id))) : [...results];
    return list.sort((a, b) => {
      if (sort === "duration") return a.duration - b.duration;
      if (sort === "stops") return a.intermediate - b.intermediate;
      if (sort === "number") return String(a.train.train_number).localeCompare(String(b.train.train_number), undefined, { numeric: true });
      return a.departure - b.departure;
    });
  }, [results, sort, favoritesOnly, favorites]);

  const fastestId = sortedResults.length ? sortedResults.reduce((best, item) => item.duration < best.duration ? item : best).train.train_id : null;
  const earliestId = sortedResults.length ? sortedResults.reduce((best, item) => item.departure < best.departure ? item : best).train.train_id : null;

  const toggleFavorite = (trainId: number) => {
    const next = new Set(favorites);
    if (next.has(trainId)) next.delete(trainId); else next.add(trainId);
    setFavorites(next);
    localStorage.setItem("sekka-favorites", JSON.stringify([...next]));
    notify(next.has(trainId) ? "تم حفظ القطار في المفضلة" : "تمت إزالة القطار من المفضلة");
  };

  const toggleCompare = (trainId: number) => {
    const next = new Set(compareIds);
    if (next.has(trainId)) next.delete(trainId);
    else if (next.size >= 3) return notify("يمكنك مقارنة 3 قطارات بحد أقصى");
    else next.add(trainId);
    setCompareIds(next);
  };

  const shareTrip = async (item: Result) => {
    const text = `قطار ${item.train.train_number}: ${item.from.station_ar} ${toClock(item.departure)} ← ${item.to.station_ar} ${toClock(item.arrival)}`;
    try {
      if (navigator.share) await navigator.share({ title: "موعد قطار على سِكّة", text, url: location.href });
      else {
        await navigator.clipboard.writeText(`${text}\n${location.href}`);
        notify("تم نسخ تفاصيل الرحلة");
      }
    } catch { /* user cancelled */ }
  };

  const runPopular = (sourceName: string, destinationName: string) => {
    if (!index) return;
    const source = index.stations.find((station) => normalize(station.ar) === normalize(sourceName)) ?? null;
    const destination = index.stations.find((station) => normalize(station.ar) === normalize(destinationName)) ?? null;
    if (source && destination) {
      setMode("route");
      setFrom(source);
      setTo(destination);
      window.setTimeout(() => searchRoute(source, destination), 0);
    }
  };

  const selectRecent = (item: RecentSearch) => {
    if (!index) return;
    const source = index.stationMap.get(item.fromId) ?? null;
    const destination = index.stationMap.get(item.toId) ?? null;
    setFrom(source);
    setTo(destination);
    setDate(item.date || todayValue());
    setMode("route");
    window.setTimeout(() => searchRoute(source, destination), 0);
  };

  const compared = sortedResults.filter((item) => compareIds.has(Number(item.train.train_id)));

  return (
    <main>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#top" aria-label="سِكّة - الرئيسية">
            <span className="brand-mark"><i></i><i></i><i></i></span>
            <span><strong>سِكّة</strong><small>دليلك لقطارات مصر</small></span>
          </a>
          <nav aria-label="القائمة الرئيسية">
            <a className="active" href="#top">الرئيسية</a>
            <a href="#search">مواعيد القطارات</a>
            <a href="#popular">الرحلات الشائعة</a>
            <a href="#help">المساعدة</a>
          </nav>
          <div className="header-actions">
            <button className="icon-button" type="button" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label="تغيير مظهر الموقع">
              <Icon name={theme === "light" ? "moon" : "sun"} />
            </button>
            <button className="icon-button mobile-menu-button" type="button" onClick={() => setMobileMenu(true)} aria-label="فتح القائمة"><Icon name="menu" /></button>
          </div>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-visual" aria-hidden="true"></div>
        <div className="hero-glow" aria-hidden="true"></div>
        <div className="hero-inner">
          <div className="hero-copy">
            <span className="eyebrow"><span></span> قاعدة مواعيد شاملة لكل أنحاء مصر</span>
            <h1>رحلتك تبدأ<br/><em>من هنا</em></h1>
            <p>ابحث وقارن بين مواعيد القطارات، واعرف كل محطة وتوقف في رحلتك خلال ثوانٍ.</p>
            <div className="hero-trust">
              <span><Icon name="search" /> بحث سريع</span>
              <span><Icon name="refresh" /> بيانات محلية</span>
              <span><Icon name="pin" /> {data ? `${arNumber(data.metadata.stations_count)} محطة` : "كل المحطات"}</span>
            </div>
          </div>

          <section className="search-card" id="search" aria-label="البحث في مواعيد القطارات">
            <div className="search-tabs" role="tablist">
              <button type="button" className={mode === "route" ? "active" : ""} onClick={() => setMode("route")}><Icon name="swap" size={18}/> بين محطتين</button>
              <button type="button" className={mode === "number" ? "active" : ""} onClick={() => setMode("number")}><Icon name="train" size={18}/> رقم القطار</button>
              <button type="button" className={mode === "station" ? "active" : ""} onClick={() => setMode("station")}><Icon name="pin" size={18}/> لوحة محطة</button>
            </div>

            {!data && !loadError && <div className="loading-line"><span></span> جارٍ تجهيز أحدث المواعيد…</div>}
            {loadError && <div className="error-line"><Icon name="info"/> تعذر تحميل قاعدة المواعيد. أعد تحميل الصفحة.</div>}

            {index && mode === "route" && (
              <div className="route-fields">
                <StationPicker label="من" placeholder="محطة القيام" stations={index.stations} value={from} onChange={setFrom}/>
                <button
                  type="button"
                  className="swap-button"
                  title="تبديل المحطتين"
                  onClick={() => { setFrom(to); setTo(from); }}
                ><Icon name="swap"/></button>
                <StationPicker label="إلى" placeholder="محطة الوصول" stations={index.stations} value={to} onChange={setTo}/>
              </div>
            )}

            {index && mode === "number" && (
              <div className="single-search-field">
                <div className="field">
                  <label htmlFor="train-number">رقم القطار</label>
                  <div className="field-control"><Icon name="train"/><input id="train-number" inputMode="numeric" value={trainNumber} onChange={(event) => setTrainNumber(event.target.value)} onKeyDown={(event) => event.key === "Enter" && searchByNumber()} placeholder="مثال: 871"/></div>
                </div>
                <button type="button" className="ghost-button" onClick={() => searchByNumber(true)}>عرض كل القطارات</button>
              </div>
            )}

            {index && mode === "station" && (
              <div className="single-search-field">
                <StationPicker label="المحطة" placeholder="اختر محطة لعرض حركتها" stations={index.stations} value={boardStation} onChange={setBoardStation}/>
                <div className="board-hint"><span className="live-dot"></span> عرض القطارات التي تمر بالمحطة حسب الجدول</div>
              </div>
            )}

            {index && (
              <div className="search-options">
                {mode !== "number" && <div className="field compact"><label htmlFor="trip-date">تاريخ السفر</label><div className="field-control"><Icon name="calendar"/><input id="trip-date" type="date" min={todayValue()} value={date} onChange={(event) => setDate(event.target.value)}/></div></div>}
                <div className="field compact"><label htmlFor="time-period">وقت التحرك</label><div className="field-control"><Icon name="clock"/><select id="time-period" value={period} onChange={(event) => setPeriod(event.target.value)}><option value="">كل الأوقات</option><option value="morning">صباحًا 4–12</option><option value="afternoon">ظهرًا 12–5</option><option value="evening">مساءً 5–9</option><option value="night">ليلًا 9–4</option></select></div></div>
                <div className="field compact"><label htmlFor="train-class">فئة القطار</label><div className="field-control"><Icon name="train"/><select id="train-class" value={trainClass} onChange={(event) => setTrainClass(event.target.value)}><option value="">كل الفئات</option>{index.classes.map((name) => <option key={name}>{name}</option>)}</select></div></div>
              </div>
            )}

            <button
              type="button"
              className="search-button"
              disabled={!index}
              onClick={() => mode === "route" ? searchRoute() : mode === "number" ? searchByNumber() : searchStation()}
            ><Icon name="search" size={23}/>{mode === "route" ? "ابحث عن القطارات" : mode === "number" ? "ابحث برقم القطار" : "اعرض لوحة المحطة"}</button>

            <div className="search-foot"><Icon name="info" size={16}/><span>{date ? `خطة السفر: ${formatDate(date)}` : "اختر تاريخ السفر"}</span><i></i><span>ليست خدمة حجز تذاكر</span></div>
          </section>
        </div>
      </section>

      <div className="quick-strip">
        <div className="quick-strip-inner">
          <strong><span className="quick-icon"><Icon name="train"/></span> رحلة سريعة</strong>
          <button type="button" onClick={() => runPopular("القاهره", "الاسكندريه")}><span>القاهرة</span><Icon name="arrow"/><span>الإسكندرية</span><small>اكتشف المواعيد</small></button>
          <div className="database-pill"><Icon name="wifi"/><span><b>تعمل بعد الزيارة الأولى</b><small>بياناتك متاحة حتى مع ضعف الاتصال</small></span></div>
        </div>
      </div>

      {!searched && (
        <section className="home-content" id="popular">
          {recent.length > 0 && <div className="section-block recent-block">
            <div className="section-heading"><div><span className="section-kicker">ارجع لرحلتك</span><h2>عمليات البحث الأخيرة</h2></div></div>
            <div className="recent-grid">{recent.map((item) => <button type="button" key={`${item.fromId}-${item.toId}`} onClick={() => selectRecent(item)}><span className="recent-route"><b>{item.from}</b><Icon name="arrow"/><b>{item.to}</b></span><small>{formatDate(item.date)}</small><span className="round-arrow"><Icon name="chevron" size={17}/></span></button>)}</div>
          </div>}

          <div className="section-block">
            <div className="section-heading"><div><span className="section-kicker">اختيارات المسافرين</span><h2>أشهر الرحلات</h2></div><p>ابدأ بسرعة من أكثر خطوط القطارات استخدامًا في مصر.</p></div>
            <div className="popular-grid">
              {POPULAR_ROUTES.map(([source, destination], indexValue) => (
                <button type="button" className="popular-card" key={`${source}-${destination}`} onClick={() => runPopular(source, destination)}>
                  <span className="popular-number">0{indexValue + 1}</span>
                  <span className="popular-icon"><Icon name="train"/></span>
                  <span className="popular-route"><strong>{source}</strong><span><i></i><Icon name="arrow" size={17}/></span><strong>{destination}</strong></span>
                  <small>اعرض كل المواعيد <Icon name="chevron" size={15}/></small>
                </button>
              ))}
            </div>
          </div>

          <div className="stats-section">
            <div className="stats-copy"><span className="section-kicker light">قاعدة واحدة شاملة</span><h2>مواعيد مصر كلها<br/>في مكان واحد</h2><p>من المحطات الرئيسية إلى أصغر محطات التوقف، ستجد تفاصيل خط السير كاملة.</p></div>
            <div className="stats-grid">
              <div><strong>{data ? arNumber(data.metadata.trains_count) : "—"}</strong><span>قطار</span></div>
              <div><strong>{data ? arNumber(data.metadata.stations_count) : "—"}</strong><span>محطة</span></div>
              <div><strong>{data ? arNumber(data.metadata.stops_count) : "—"}</strong><span>توقف مسجل</span></div>
              <div><strong>{data ? arNumber(data.metadata.classes_count) : "—"}</strong><span>فئة قطار</span></div>
            </div>
          </div>
        </section>
      )}

      {searched && (
        <section className="results-section" ref={resultsRef}>
          <div className="results-top">
            <div><button type="button" className="back-search" onClick={() => setSearched(false)}><Icon name="arrow" size={17}/> بحث جديد</button><span className="section-kicker">نتائج البحث</span><h2>{resultTitle}</h2><p>{sortedResults.length ? `${arNumber(sortedResults.length)} رحلة مطابقة${date && mode !== "number" ? ` • ${formatDate(date)}` : ""}` : "لم نعثر على رحلات مطابقة"}</p></div>
            <div className="result-tools">
              <button type="button" className={favoritesOnly ? "tool-button active" : "tool-button"} onClick={() => setFavoritesOnly(!favoritesOnly)}><Icon name="heart" size={18}/> المفضلة</button>
              <label>ترتيب النتائج<select value={sort} onChange={(event) => setSort(event.target.value as SortMode)}><option value="departure">الأقرب موعدًا</option><option value="duration">الأسرع وصولًا</option><option value="stops">الأقل توقفًا</option><option value="number">رقم القطار</option></select></label>
            </div>
          </div>

          {sortedResults.length ? <div className="result-list">
            {sortedResults.slice(0, shown).map((item) => {
              const trainId = Number(item.train.train_id);
              const isFavorite = favorites.has(trainId);
              const isCompared = compareIds.has(trainId);
              const boardTime = item.boardStop ? Number(item.boardStop.departure_absolute_minute ?? item.boardStop.arrival_absolute_minute ?? 0) : null;
              return (
                <article className="train-card" key={`${trainId}-${item.fromIndex}-${item.toIndex}`}>
                  <div className="train-card-side">
                    <span>قطار رقم</span><strong>{item.train.train_number}</strong><small>{item.train.class_ar || "فئة غير محددة"}</small>
                    {trainId === fastestId && mode === "route" && <b className="smart-badge">الأسرع</b>}
                    {trainId === earliestId && mode === "route" && trainId !== fastestId && <b className="smart-badge gold">الأقرب</b>}
                  </div>
                  <div className="train-card-main">
                    {item.boardStop ? (
                      <div className="station-board-row">
                        <div><span className="live-dot"></span><small>موعد القطار في {item.boardStop.station_ar}</small><strong>{toClock(boardTime!)}</strong><span>{item.boardStop.departure_time === item.boardStop.arrival_time ? "وصول / تحرك" : `وصول ${item.boardStop.arrival_time} • تحرك ${item.boardStop.departure_time}`}</span></div>
                        <div className="board-direction"><small>خط السير</small><strong>{item.train.origin_ar} ← {item.train.destination_ar}</strong></div>
                      </div>
                    ) : (
                      <div className="trip-times">
                        <div className="time-point"><small>قيام</small><strong>{toClock(item.departure)}</strong><span>{item.from.station_ar}</span></div>
                        <div className="trip-rail"><span>{durationText(item.duration)}</span><div><i></i><b><Icon name="train" size={17}/></b><i></i></div><small>{arNumber(item.intermediate)} محطة بينية</small></div>
                        <div className="time-point end"><small>وصول</small><strong>{toClock(item.arrival)}</strong><span>{item.to.station_ar}{item.arrival >= 1440 && <em> +1 يوم</em>}</span></div>
                      </div>
                    )}
                    <div className="train-meta"><span><Icon name="pin" size={16}/> المسار الكامل: {item.train.origin_ar} ← {item.train.destination_ar}</span><span><Icon name="clock" size={16}/> {arNumber(item.train.stops_count)} توقف</span>{item.train.info && <span><Icon name="info" size={16}/> {item.train.info}</span>}</div>
                  </div>
                  <div className="train-card-actions">
                    <button type="button" className={isFavorite ? "small-icon active" : "small-icon"} onClick={() => toggleFavorite(trainId)} aria-label="إضافة إلى المفضلة"><Icon name="heart" size={19}/></button>
                    <button type="button" className="small-icon" onClick={() => shareTrip(item)} aria-label="مشاركة الرحلة"><Icon name="share" size={19}/></button>
                    <label className={isCompared ? "compare-check active" : "compare-check"}><input type="checkbox" checked={isCompared} onChange={() => toggleCompare(trainId)}/><span><Icon name="check" size={13}/></span> قارن</label>
                    <button type="button" className="details-button" onClick={() => setDetail(item)}>تفاصيل الرحلة <Icon name="chevron" size={17}/></button>
                  </div>
                </article>
              );
            })}
            {shown < sortedResults.length && <button className="load-more" type="button" onClick={() => setShown(shown + 12)}>عرض المزيد من الرحلات <span>{arNumber(Math.min(12, sortedResults.length - shown))}</span></button>}
          </div> : <div className="empty-results"><span><Icon name={favoritesOnly ? "heart" : "train"} size={38}/></span><h3>{favoritesOnly ? "لا توجد قطارات مفضلة ضمن النتائج" : "لا توجد رحلات مطابقة"}</h3><p>{favoritesOnly ? "ألغِ فلتر المفضلة أو احفظ قطارًا أولًا." : "جرّب تغيير وقت السفر أو فئة القطار أو اختر محطات أخرى."}</p><button type="button" onClick={() => { setPeriod(""); setTrainClass(""); setFavoritesOnly(false); }}>إلغاء الفلاتر</button></div>}
        </section>
      )}

      <section className="help-section" id="help">
        <div className="section-heading"><div><span className="section-kicker">كل ما تحتاج معرفته</span><h2>أسئلة شائعة</h2></div><p>إجابات واضحة قبل أن تبدأ رحلتك.</p></div>
        <div className="faq-grid">
          <details><summary>هل يمكن حجز تذكرة من الموقع؟<span>+</span></summary><p>الموقع دليل ذكي للمواعيد وخطوط السير فقط. احجز التذكرة من القنوات الرسمية بعد اختيار القطار المناسب.</p></details>
          <details><summary>هل المواعيد تعمل بدون إنترنت؟<span>+</span></summary><p>بعد فتح الموقع وتحميل البيانات أول مرة، يحتفظ المتصفح بنسخة تساعدك على الوصول إليها عند ضعف الاتصال.</p></details>
          <details><summary>كيف أعرف جميع محطات القطار؟<span>+</span></summary><p>اضغط «تفاصيل الرحلة» أمام أي قطار لعرض خط السير كاملًا مع وقت الوصول والتحرك في كل محطة.</p></details>
          <details><summary>هل يمكن البحث باسم المحطة فقط؟<span>+</span></summary><p>نعم، اختر «لوحة محطة» لعرض كل القطارات التي تمر بالمحطة في يوم ووقت محددين.</p></details>
        </div>
      </section>

      <footer>
        <div className="footer-main">
          <a className="brand footer-brand" href="#top"><span className="brand-mark"><i></i><i></i><i></i></span><span><strong>سِكّة</strong><small>رحلتك أوضح وأسهل</small></span></a>
          <p>دليل مستقل لعرض جداول القطارات المخزنة. المواعيد قابلة للتغيير ويجب تأكيدها من الجهة الرسمية قبل السفر.</p>
          <div><a href="#search">البحث</a><a href="#popular">الرحلات الشائعة</a><a href="#help">المساعدة</a></div>
        </div>
        <div className="footer-bottom"><span>آخر تحديث للبيانات: {data?.metadata.database_date ?? "جارٍ التحميل"}</span><span>صُمّم بعناية للمسافر المصري</span></div>
      </footer>

      {compareIds.size > 0 && <div className="compare-bar"><div><span className="compare-icon"><Icon name="compare"/></span><span><strong>{arNumber(compareIds.size)} قطار محدد</strong><small>يمكنك مقارنة 3 قطارات معًا</small></span></div><div><button type="button" className="clear-compare" onClick={() => setCompareIds(new Set())}>إلغاء</button><button type="button" className="open-compare" disabled={compareIds.size < 2} onClick={() => setCompareOpen(true)}>قارن الآن</button></div></div>}

      {detail && index && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setDetail(null)}>
        <section className="detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title">
          <header><div><span>تفاصيل خط السير</span><h2 id="detail-title">قطار {detail.train.train_number} <small>{detail.train.class_ar}</small></h2></div><button type="button" className="modal-close" onClick={() => setDetail(null)} aria-label="إغلاق"><Icon name="close"/></button></header>
          <div className="detail-summary"><div><small>من</small><strong>{detail.from.station_ar}</strong><span>{toClock(detail.departure)}</span></div><Icon name="arrow"/><div><small>إلى</small><strong>{detail.to.station_ar}</strong><span>{toClock(detail.arrival)}</span></div><div><small>المدة</small><strong>{durationText(detail.duration)}</strong><span>{arNumber(detail.intermediate)} محطة بينية</span></div></div>
          <div className="timeline-title"><h3>المحطات والتوقفات</h3><span>{arNumber((index.stopsByTrain.get(Number(detail.train.train_id)) ?? []).length)} محطة في المسار الكامل</span></div>
          <div className="timeline">
            {(index.stopsByTrain.get(Number(detail.train.train_id)) ?? []).map((stop, position, all) => {
              const selected = position >= detail.fromIndex && position <= detail.toIndex;
              const edge = position === detail.fromIndex || position === detail.toIndex;
              return <div className={`timeline-stop ${selected ? "selected" : ""} ${edge ? "edge" : ""}`} key={`${stop.station_id}-${position}`}><div className="timeline-marker"><i></i></div><div><strong>{stop.station_ar}</strong><small>{stop.station_en}</small>{stop.note && <em>{stop.note}</em>}</div><div className="timeline-times"><span><small>وصول</small>{position === 0 ? "—" : stop.arrival_time}</span><span><small>تحرك</small>{position === all.length - 1 ? "—" : stop.departure_time}</span>{Math.max(stop.arrival_day_offset, stop.departure_day_offset) > 0 && <b>اليوم التالي</b>}</div></div>;
            })}
          </div>
          <div className="modal-actions"><button type="button" onClick={() => shareTrip(detail)}><Icon name="share"/> مشاركة الموعد</button><button type="button" className="primary" onClick={() => toggleFavorite(Number(detail.train.train_id))}><Icon name="heart"/> {favorites.has(Number(detail.train.train_id)) ? "محفوظ في المفضلة" : "حفظ القطار"}</button></div>
        </section>
      </div>}

      {compareOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setCompareOpen(false)}>
        <section className="compare-modal" role="dialog" aria-modal="true" aria-labelledby="compare-title">
          <header><div><span>اختر الأنسب لك</span><h2 id="compare-title">مقارنة القطارات</h2></div><button type="button" className="modal-close" onClick={() => setCompareOpen(false)} aria-label="إغلاق"><Icon name="close"/></button></header>
          <div className="compare-table">
            <div className="compare-labels"><span>القطار</span><span>الفئة</span><span>القيام</span><span>الوصول</span><span>المدة</span><span>المحطات البينية</span></div>
            {compared.map((item) => <div className="compare-column" key={item.train.train_id}><strong>{item.train.train_number}</strong><span>{item.train.class_ar}</span><b>{toClock(item.departure)}</b><b>{toClock(item.arrival)}</b><span>{durationText(item.duration)}</span><span>{arNumber(item.intermediate)}</span></div>)}
          </div>
        </section>
      </div>}

      {mobileMenu && <div className="mobile-drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setMobileMenu(false)}><aside className="mobile-drawer"><div className="drawer-head"><span className="brand"><span className="brand-mark"><i></i><i></i><i></i></span><span><strong>سِكّة</strong><small>دليلك لقطارات مصر</small></span></span><button type="button" className="modal-close" onClick={() => setMobileMenu(false)}><Icon name="close"/></button></div><nav><a href="#top" onClick={() => setMobileMenu(false)}>الرئيسية</a><a href="#search" onClick={() => setMobileMenu(false)}>مواعيد القطارات</a><a href="#popular" onClick={() => setMobileMenu(false)}>الرحلات الشائعة</a><a href="#help" onClick={() => setMobileMenu(false)}>المساعدة</a></nav></aside></div>}

      <div className={toast ? "toast show" : "toast"}><Icon name="check" size={17}/>{toast}</div>
    </main>
  );
}
