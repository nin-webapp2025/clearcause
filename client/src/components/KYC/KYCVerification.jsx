import React from "react"

import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"

const KYCVerification = () => {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">KYC Verification</h1>
      <Card>
        <CardHeader>
          <CardTitle>Submit KYC Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" placeholder="Enter your full name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="Enter your email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nationality">Nationality</Label>
              <Input id="nationality" placeholder="Enter your nationality" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="idNumber">ID Number</Label>
              <Input id="idNumber" placeholder="Enter your ID number" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="idImage">ID Image</Label>
              <Input id="idImage" type="file" accept="image/*" />
            </div>
            <Button type="submit" className="w-full">
              Submit KYC
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default KYCVerification

