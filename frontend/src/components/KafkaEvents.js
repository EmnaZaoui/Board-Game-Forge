import React, { useEffect, useState } from 'react';

const KafkaEvents = () => {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const eventSource = new EventSource('http://localhost:3000/api/kafka/stream');
    eventSource.onmessage = (e) => {
      const newEvent = JSON.parse(e.data);
      setEvents(prev => [newEvent, ...prev.slice(0, 49)]);
    };
    return () => eventSource.close();
  }, []);

  return (
    <div className="gaming-card">
      <h2 className="gaming-title">Flux Kafka en direct</h2>
      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
        {events.length === 0 && <p>En attente d'événements...</p>}
        {events.map((ev, idx) => (
          <div key={idx} className="kafka-event">
            <strong>{ev.topic}</strong> [{ev.timestamp}]<br />
            {JSON.stringify(ev.value, null, 2)}
          </div>
        ))}
      </div>
    </div>
  );
};

export default KafkaEvents;