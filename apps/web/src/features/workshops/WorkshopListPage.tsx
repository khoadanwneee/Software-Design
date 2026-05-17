import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, MapPin, Search, X } from "lucide-react";
import type { WorkshopDto, WorkshopListFilters, WorkshopPriceType } from "@unihub/shared-types";
import { WorkshopCategory } from "@unihub/shared-types";
import { api } from "../../lib/api";
import { useDebouncedValue } from "../../lib/useDebouncedValue";
import { AiSummaryStatusBadge } from "../ai-summary/AiSummaryRichText";
import { useWorkshopSeatAvailability } from "./useWorkshopSeatAvailability";

export function WorkshopListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [keyword, setKeyword] = useState(searchParams.get("keyword") ?? "");
  const debouncedKeyword = useDebouncedValue(keyword, 400);

  useEffect(() => {
    setKeyword(searchParams.get("keyword") ?? "");
  }, [searchParams]);

  useEffect(() => {
    const current = searchParams.get("keyword") ?? "";
    if (debouncedKeyword === current) {
      return;
    }

    const next = new URLSearchParams(searchParams);
    if (debouncedKeyword.trim()) {
      next.set("keyword", debouncedKeyword.trim());
    } else {
      next.delete("keyword");
    }
    setSearchParams(next, { replace: true });
  }, [debouncedKeyword, searchParams, setSearchParams]);

  const filters = useMemo<WorkshopListFilters>(() => {
    const priceType = searchParams.get("priceType") as WorkshopPriceType | null;
    return {
      keyword: searchParams.get("keyword") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      roomId: searchParams.get("roomId") ?? undefined,
      fromDate: searchParams.get("fromDate") ?? undefined,
      toDate: searchParams.get("toDate") ?? undefined,
      hasSeats: searchParams.get("hasSeats") === "true" ? true : undefined,
      priceType: priceType ?? "all",
      limit: 100
    };
  }, [searchParams]);

  const query = useQuery({ queryKey: ["workshops", filters], queryFn: () => api.workshopApi.list(filters) });
  const rooms = useQuery({ queryKey: ["rooms"], queryFn: () => api.roomApi.list() });

  function updateParam(name: string, value: string | boolean) {
    const next = new URLSearchParams(searchParams);
    const normalized = String(value);
    if (!normalized || normalized === "false" || normalized === "all") {
      next.delete(name);
    } else {
      next.set(name, normalized);
    }
    setSearchParams(next, { replace: true });
  }

  function clearFilters() {
    setKeyword("");
    setSearchParams({}, { replace: true });
  }

  const categoryOptions = Object.values(WorkshopCategory);

  return (
    <section>
      <div className="section-header">
        <h1>Workshops</h1>
        <button className="secondary" onClick={clearFilters}>
          <X size={18} /> Clear filters
        </button>
      </div>
      <div className="panel filters-panel">
        <label className="full">
          Search
          <span className="input-with-icon">
            <Search size={18} />
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Search title or description" />
          </span>
        </label>
        <label>
          Category
          <select value={searchParams.get("category") ?? ""} onChange={(event) => updateParam("category", event.target.value)}>
            <option value="">All categories</option>
            {categoryOptions.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label>
          Room
          <select value={searchParams.get("roomId") ?? ""} onChange={(event) => updateParam("roomId", event.target.value)}>
            <option value="">All rooms</option>
            {rooms.data?.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          From date
          <input
            type="date"
            value={searchParams.get("fromDate") ?? ""}
            onChange={(event) => updateParam("fromDate", event.target.value)}
          />
        </label>
        <label>
          To date
          <input
            type="date"
            value={searchParams.get("toDate") ?? ""}
            onChange={(event) => updateParam("toDate", event.target.value)}
          />
        </label>
        <label>
          Seats
          <select value={searchParams.get("hasSeats") ?? "false"} onChange={(event) => updateParam("hasSeats", event.target.value)}>
            <option value="false">All</option>
            <option value="true">Only available</option>
          </select>
        </label>
        <label>
          Price
          <select value={searchParams.get("priceType") ?? "all"} onChange={(event) => updateParam("priceType", event.target.value)}>
            <option value="all">All</option>
            <option value="free">Free</option>
            <option value="paid">Paid</option>
          </select>
        </label>
      </div>
      {query.isLoading ? <p>Loading...</p> : null}
      {query.error ? <p className="error">{query.error.message}</p> : null}
      {!query.isLoading && query.data?.length === 0 ? <p className="notice">No workshops match the current filters.</p> : null}
      <div className="grid">
        {query.data?.map((workshop) => <WorkshopCard key={workshop.id} workshop={workshop} />)}
      </div>
    </section>
  );
}

function WorkshopCard({ workshop }: { workshop: WorkshopDto }) {
  const seat = useWorkshopSeatAvailability(workshop);
  const isFull = seat.remainingSeats <= 0;

  return (
    <Link to={`/workshops/${workshop.id}`} className="workshop-card">
      <div className="badge-row">
        <span className={workshop.priceAmount > 0 ? "badge paid" : "badge free"}>
          {workshop.priceAmount > 0 ? `${workshop.priceAmount.toLocaleString("en-US")} ${workshop.currency}` : "Free"}
        </span>
        <AiSummaryStatusBadge status={workshop.aiSummary?.status} />
      </div>
      <h2>{workshop.title}</h2>
      <p>{workshop.description}</p>
      <div className="meta">
        <span>
          <CalendarDays size={16} /> {new Date(workshop.startTime).toLocaleString("en-US")}
        </span>
        <span>
          <MapPin size={16} /> {workshop.room.name}
        </span>
      </div>
      <progress value={seat.registeredCount} max={seat.capacity} />
      <small className={isFull ? "sold-out" : undefined}>{isFull ? "Sold out" : `${seat.remainingSeats} seats left`}</small>
    </Link>
  );
}
