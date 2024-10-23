import { Avatar } from "@shared/components/ui/Avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@shared/components/ui/Card";

const testimonials = [
  {
    name: "John Doe",
    role: "Panhandler",
    image:
      "https://images.unsplash.com/photo-1651613543604-195861551d15?q=80&w=1770&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    quote: "Receiving donations has never been easier. I love that I can choose to use my credits in stores or redeem them for cash.",
  },
  {
    name: "Jane Smith",
    role: "Donor",
    image:
      "https://images.unsplash.com/photo-1542596594-649edbc13630?q=80&w=1887&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    quote: "SpareChange has made it incredibly easy for me to make a difference. I can donate my spare change with just a scan!",
  },
];

export const Testimonials = () => {
  return (
    <section id="testimonials" className={`py-12 w-full`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className={`text-3xl font-bold text-center mb-8`}>Testimonials</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="p-4 flex flex-col items-center">
              <CardHeader className="p-2 text-4xl">
                <Avatar size="lg" src={testimonial.image} alt={testimonial.name} className="object-cover" />
              </CardHeader>
              <CardTitle className="text-xl">{testimonial.name}</CardTitle>
              <CardDescription>{testimonial.role}</CardDescription>
              <CardContent>{testimonial.quote}</CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
