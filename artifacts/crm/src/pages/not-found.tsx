import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-foreground mb-4">404</h1>
        <p className="text-muted-foreground mb-6">Página no encontrada</p>
        <Link href="/dashboard">
          <Button className="bg-primary">Ir al inicio</Button>
        </Link>
      </div>
    </div>
  );
}
