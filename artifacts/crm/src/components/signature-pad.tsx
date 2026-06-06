import React, { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  onSave: (dataUrl: string) => void;
  disabled?: boolean;
}

export function SignaturePad({ onSave, disabled }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    drawing.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    const pos = getPos(e);
    ctx?.beginPath();
    ctx?.moveTo(pos.x, pos.y);
  };

  const move = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    const pos = getPos(e);
    ctx?.lineTo(pos.x, pos.y);
    ctx?.stroke();
  };

  const end = () => { drawing.current = false; };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const save = () => {
    const canvas = canvasRef.current;
    if (canvas) onSave(canvas.toDataURL("image/png"));
  };

  return (
    <div className="space-y-3">
      <canvas
        ref={canvasRef}
        width={400}
        height={150}
        className="border rounded-lg bg-white w-full touch-none cursor-crosshair"
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={clear} disabled={disabled}>Limpiar</Button>
        <Button size="sm" onClick={save} disabled={disabled}>Firmar</Button>
      </div>
    </div>
  );
}
