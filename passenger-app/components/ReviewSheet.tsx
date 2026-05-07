"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useLocationStore } from '@/store/location.store';
import { Star, Loader2, CheckCircle } from 'lucide-react';
import api from '@/services/api';

const QUICK_TAGS = ['Great driver!', 'Very punctual', 'Clean car', 'Friendly', 'Safe driving'];

export function ReviewSheet() {
  const setUiState = useLocationStore((s) => s.setUiState);
  const driverDetails = useLocationStore((s) => s.driverDetails);
  const setDestination = useLocationStore((s) => s.setDestination);
  const setRouteCoordinates = useLocationStore((s) => s.setRouteCoordinates);
  const setDriverLocation = useLocationStore((s) => s.setDriverLocation);
  const setDriverDetails = useLocationStore((s) => s.setDriverDetails);

  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (rating === 0) return;
    setIsSubmitting(true);

    try {
      const currentRideId = useLocationStore.getState().currentRideId;
      const driverId = useLocationStore.getState().driverDetails?.id;
      const userStr = localStorage.getItem('user');
      const userId = userStr ? JSON.parse(userStr).id : null;

      const fullComment = [comment, ...selectedTags].filter(Boolean).join('. ');
      
      await api.post('/api/reviews', {
        rideId: currentRideId,
        driverId: driverId, // Pass driverId to ensure Backend can update the correct driver profile
        rating,
        comment: fullComment
      }, {
        headers: {
          'x-user-id': userId
        }
      });

      setIsSubmitting(false);
      setSubmitted(true);

      setTimeout(() => {
        // Reset app state
        setUiState('map');
        setDestination(null as any);
        setRouteCoordinates(null);
        setDriverLocation(null);
        setDriverDetails(null);
      }, 1500);
    } catch (err) {
      console.error('Failed to submit review', err);
      setIsSubmitting(false);
      alert('Could not submit review. Please try again.');
    }
  };

  return (
    <motion.div
      initial={{ y: '100%', opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: '100%', opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="absolute bottom-0 w-full z-[1050] pointer-events-none"
    >
      <div className="bg-white rounded-t-3xl shadow-[0_-20px_60px_-10px_rgba(0,0,0,0.2)] p-5 pb-8 pointer-events-auto">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

        {submitted ? (
          <div className="py-6 text-center">
             <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-9 h-9 text-[var(--color-primary)]" />
             </div>
             <h2 className="text-xl font-bold text-gray-900 mb-1">Cảm ơn bạn!</h2>
             <p className="text-sm text-gray-500">Đánh giá của bạn giúp dịch vụ tốt hơn.</p>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-1">Đánh giá chuyến đi</h2>
              {driverDetails && (
                <p className="text-sm text-gray-500">{driverDetails.name} · {driverDetails.vehicle}</p>
              )}
            </div>

            {/* Star Rating */}
            <div className="flex justify-center gap-3 mb-5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  onClick={() => setRating(star)}
                  className="transition-transform active:scale-90"
                >
                  <Star
                    className={`w-10 h-10 transition-colors ${
                      star <= (hoveredRating || rating)
                        ? 'text-yellow-400 fill-yellow-400'
                        : 'text-gray-200 fill-gray-200'
                    }`}
                  />
                </button>
              ))}
            </div>

            {rating > 0 && (
              <p className="text-center text-sm font-medium text-gray-500 mb-5">
                {['', 'Rất tệ', 'Tệ', 'Bình thường', 'Tốt', 'Tuyệt vời!'][rating]}
              </p>
            )}

            {/* Quick Tags */}
            <div className="flex flex-wrap gap-2 mb-4">
              {QUICK_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                    selectedTags.includes(tag)
                      ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                      : 'bg-gray-50 text-gray-600 border-gray-200'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* Comment Box */}
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Bạn có muốn chia sẻ thêm điều gì không? (không bắt buộc)"
              rows={2}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-[var(--color-primary)] resize-none mb-4"
            />

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={rating === 0 || isSubmitting}
              className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] disabled:opacity-50 active:scale-[0.98] transition-all text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Đang gửi...</>
              ) : (
                'Gửi đánh giá'
              )}
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}
