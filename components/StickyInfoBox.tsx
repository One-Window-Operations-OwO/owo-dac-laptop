'use client';

import { useRef, useState, useMemo, useEffect } from "react";
import { useDraggable } from './hooks/useDraggable';

export default function StickyInfoBox({
    schoolData,
    itemData,
    date,
    setDate,
}: {
    schoolData: Record<string, string>;
    itemData: Record<string, string>;
    date: string;
    setDate: (date: string) => void;
}) {
    // State lifted to parent
    const boxRef = useRef<HTMLDivElement>(null!);
    const { position, handleMouseDown } = useDraggable<HTMLDivElement>(
        boxRef,
        "sticky-info-box",
    );

    return (
        <div
            ref={boxRef}
            style={{
                position: 'absolute',
                left: position.x,
                top: position.y,
                touchAction: 'none' // Important for touch devices
            }}
            onMouseDown={handleMouseDown}
            onTouchStart={handleMouseDown} // Support touch start
            onClick={(e) => e.stopPropagation()} // Prevent click from closing parent modal
            className="z-[100] bg-zinc-900/95 backdrop-blur-md p-4 rounded-lg shadow-2xl border border-zinc-700 max-w-sm cursor-move text-zinc-100"
        >
            <div className="mb-4 pb-2 border-b border-zinc-700">
                <label className="block text-xs font-bold text-zinc-400 mb-1 uppercase tracking-wider">Tanggal Verifikasi</label>
                <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                    onMouseDown={(e) => e.stopPropagation()} // Prevent drag start on input interaction
                    onTouchStart={(e) => e.stopPropagation()}
                />
            </div>

            <h3 className="text-sm font-bold text-zinc-300 border-b border-zinc-700 pb-2 mb-2">
                Data Sekolah
            </h3>
            <div className="space-y-1 text-xs mb-4">
                <div className="grid grid-cols-3 gap-1">
                    <span className="font-semibold text-zinc-500">NPSN</span>
                    <span className="col-span-2 font-mono text-zinc-200">{schoolData.npsn || '-'}</span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                    <span className="font-semibold text-zinc-500">Nama</span>
                    <span className="col-span-2 text-zinc-200">{schoolData.nama_sekolah || '-'}</span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                    <span className="font-semibold text-zinc-500">Kecamatan</span>
                    <span className="col-span-2 text-zinc-200">{schoolData.kecamatan || '-'}</span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                    <span className="font-semibold text-zinc-500">Kab/Kota</span>
                    <span className="col-span-2 text-zinc-200">{schoolData.kabupaten || '-'}</span>
                </div>
            </div>

            <h3 className="text-sm font-bold text-zinc-300 border-b border-zinc-700 pb-2 mb-2">
                Data Barang
            </h3>
            <div className="space-y-1 text-xs">
                <div className="grid grid-cols-3 gap-1">
                    <span className="font-semibold text-zinc-500">SN Unit</span>
                    <span className="col-span-2 font-mono font-bold text-blue-400">{itemData.serial_number || '-'}</span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                    <span className="font-semibold text-zinc-500">Model</span>
                    <span className="col-span-2 text-zinc-200">{itemData.nama_barang || '-'}</span>
                </div>
            </div>
        </div>
    );
}
