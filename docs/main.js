import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import heatmap from '../src/index.js';

const map = L.map('map').setView([55.75, 37.61], 10);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
}).addTo(map);

// 100 random points
const points = Array.from({ length: 100 }, () => [
    55.7 + Math.random() * 10,
    37.55 + Math.random() * 20,
    Math.floor(Math.random() * 30)
]);

// Прямоугольный полигон вокруг точек
const lats = points.map(p => p[0]);
const lngs = points.map(p => p[1]);
const minLat = Math.min(...lats);
const maxLat = Math.max(...lats);
const minLng = Math.min(...lngs);
const maxLng = Math.max(...lngs);

const polygon = [
    [minLat, minLng],
    [minLat, maxLng],
    [maxLat, maxLng],
    [maxLat, minLng],
    [minLat, minLng]
];

heatmap(points, { polygon: [polygon] }).addTo(map);

points.forEach(([lat, lng, value]) => {
    L.marker([lat, lng]).bindPopup(`Value: ${value}`).addTo(map);
});

requestAnimationFrame(() => {
    map.fitBounds(L.polygon(polygon).getBounds())
});
