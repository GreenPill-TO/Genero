'use client'

import { Button } from '@shared/components/ui/Button'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { LuHome, LuQrCode, LuSend, LuUsers, LuMoreHorizontal } from 'react-icons/lu'
import { useModal } from '@shared/contexts/ModalContext'
import {
  CharitySelectModal,
  ContactSelectModal,
  OffRampModal,
  TopUpModal,
  UserProfileModal,
} from '@tcoin/wallet/components/modals'

export default function DashboardFooter() {
  const router = useRouter()
  const { openModal, closeModal } = useModal()
  const [showMore, setShowMore] = useState(false)
  const [selectedCharity, setSelectedCharity] = useState('')

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background">
      <div className="flex justify-between">
        <Button
          variant="ghost"
          className="flex-1 flex flex-col items-center gap-1 py-2"
          onClick={() => router.push('/tcoin/wallet/dashboard')}
        >
          <LuHome className="h-5 w-5" />
          <span className="text-xs">Home</span>
        </Button>
        <Button
          variant="ghost"
          className="flex-1 flex flex-col items-center gap-1 py-2"
          onClick={() => scrollTo('receive-card')}
        >
          <LuQrCode className="h-5 w-5" />
          <span className="text-xs">Receive</span>
        </Button>
        <Button
          variant="ghost"
          className="flex-1 flex flex-col items-center gap-1 py-2"
          onClick={() => scrollTo('send-card')}
        >
          <LuSend className="h-5 w-5" />
          <span className="text-xs">Send</span>
        </Button>
        <Button
          variant="ghost"
          className="flex-1 flex flex-col items-center gap-1 py-2"
          onClick={() =>
            openModal({
              content: <ContactSelectModal closeModal={closeModal} amount="" method="Send" />,
              title: 'Contacts',
              description: 'Select a contact.',
            })
          }
        >
          <LuUsers className="h-5 w-5" />
          <span className="text-xs">Contacts</span>
        </Button>
        <div className="relative flex-1">
          <Button
            variant="ghost"
            className="w-full flex flex-col items-center gap-1 py-2"
            onClick={() => setShowMore((p) => !p)}
          >
            <LuMoreHorizontal className="h-5 w-5" />
            <span className="text-xs">More</span>
          </Button>
          {showMore && (
            <div className="absolute right-2 bottom-14 w-48 rounded-md border bg-background p-2 shadow-lg">
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => {
                  openModal({ content: <TopUpModal closeModal={closeModal} />, title: 'Top Up' })
                  setShowMore(false)
                }}
              >
                Top Up
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => {
                  openModal({ content: <OffRampModal closeModal={closeModal} />, title: 'Cash Out' })
                  setShowMore(false)
                }}
              >
                Cash Out
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => {
                  openModal({
                    content: (
                      <CharitySelectModal
                        closeModal={closeModal}
                        selectedCharity={selectedCharity}
                        setSelectedCharity={setSelectedCharity}
                      />
                    ),
                    title: 'Set Default Charity',
                  })
                  setShowMore(false)
                }}
              >
                Set Default Charity
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => {
                  openModal({ content: <UserProfileModal closeModal={closeModal} />, title: 'Edit Profile' })
                  setShowMore(false)
                }}
              >
                Edit Profile
              </Button>
              <Button variant="ghost" className="w-full justify-start" disabled>
                Select Theme
              </Button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}

