/** Scoped to Kanban columns, including the isolated visual preview. */
export function KdsScrollbarStyles() {
  return (
    <style>{`
    [id^="kds-kanban-scroll-"] {
      color-scheme: dark;
      scrollbar-width: thin;
      scrollbar-color: #666666 #161616;
    }
    [id^="kds-kanban-scroll-"]:hover,
    [id^="kds-kanban-scroll-"]:focus-within {
      scrollbar-color: #999999 #161616;
    }
    [id^="kds-kanban-scroll-"]::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    [id^="kds-kanban-scroll-"]::-webkit-scrollbar-track {
      background: #161616;
      border-radius: 8px;
    }
    [id^="kds-kanban-scroll-"]::-webkit-scrollbar-thumb {
      background: #666666;
      border: 2px solid #161616;
      border-radius: 8px;
    }
    [id^="kds-kanban-scroll-"]::-webkit-scrollbar-thumb:hover {
      background: #999999;
    }
    [id^="kds-kanban-scroll-"]::-webkit-scrollbar-button {
      display: none;
    }
    [id^="kds-kanban-scroll-"]::-webkit-scrollbar-corner {
      background: #161616;
    }
  `}</style>
  );
}
