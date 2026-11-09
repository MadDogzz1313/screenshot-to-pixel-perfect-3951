import { Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { categoryById, type Spot } from "@/lib/demo-data";

export function SpotCard({ spot }: { spot: Spot }) {
  const cat = categoryById(spot.category);
  return (
    <Link to="/fundort/$id" params={{ id: spot.id }} className="neon-card flex gap-3 overflow-hidden p-2">
      <img src={spot.images[0]} alt={spot.title} loading="lazy" className="h-20 w-24 shrink-0 rounded-xl object-cover" />
      <div className="min-w-0 flex-1 py-1">
        <span className={`inline-flex items-center gap-1 rounded-full ${cat.color} px-2 py-0.5 text-[10px] font-semibold`}>
          <cat.icon className="h-3 w-3" />{cat.label}
        </span>
        <p className="mt-1 truncate font-semibold">{spot.title}</p>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">{spot.area} · <Heart className="h-3 w-3" />{spot.likes}</p>
      </div>
    </Link>
  );
}
