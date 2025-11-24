import { useEffect, useRef } from "react";

/**
 * Hook to handle browser back button for modals/menus
 * When a modal/menu is open, pressing back button closes it instead of navigating away
 * 
 * @param isOpen - Whether the modal/menu is currently open
 * @param onClose - Function to call when back button is pressed
 */
export function useBackButtonHandler(isOpen: boolean, onClose: () => void) {
  const modalIdRef = useRef<string | null>(null);
  const isClosingViaBackRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isOpen) {
      // If modal closes normally (not via back button), remove our history entry
      if (modalIdRef.current && !isClosingViaBackRef.current) {
        // Check if current state is our modal state
        const currentState = window.history.state;
        if (currentState?.modalId === modalIdRef.current) {
          // Replace with a clean state to remove the modal entry
          window.history.replaceState({}, "");
        }
        modalIdRef.current = null;
      }
      isClosingViaBackRef.current = false;
      return;
    }

    // When modal opens, push a state to history with unique ID
    // This creates a history entry that we can intercept
    const modalId = `modal-${Date.now()}-${Math.random()}`;
    modalIdRef.current = modalId;
    window.history.pushState({ modalId, modal: true }, "");

    // Handle back button press
    const handlePopState = (event: PopStateEvent) => {
      // If modal is open and back button was pressed
      if (modalIdRef.current && isOpen) {
        // Mark that we're closing via back button
        isClosingViaBackRef.current = true;
        // Close the modal
        onClose();
        // Clean up
        modalIdRef.current = null;
      }
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      // Clean up history if component unmounts while modal is open
      if (modalIdRef.current) {
        try {
          const currentState = window.history.state;
          if (currentState?.modalId === modalIdRef.current) {
            // Replace state instead of going back to avoid navigation
            window.history.replaceState({}, "");
          }
        } catch (e) {
          // Ignore errors if history is already cleaned up
        }
        modalIdRef.current = null;
      }
    };
  }, [isOpen, onClose]);
}

